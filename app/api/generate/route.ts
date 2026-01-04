import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { retrieveCurriculumBundles } from "@/lib/curriculum/retrieve";
import { systemPrompt } from "@/lib/prompts/system";
import { lessonPlannerPrompt } from "@/lib/prompts/lessonPlanner";
import {
  mcqPrompt,
  slidesPackPrompt,
  worksheetPrompt,
} from "@/lib/prompts/resourceGenerator";
import { feedbackPrompt } from "@/lib/prompts/feedback";
import { evaluateScope } from "@/lib/prompts/scopePolicy";
import { logUsageEvent } from "@/lib/usage/logUsage";
import {
  type Citation,
  GenericOutputSchema,
  McqResourceSchema,
  SlidesPackResourceSchema,
  WorksheetResourceSchema,
  type ResourceOutput,
} from "@/lib/validators/output";

const LIMITS = {
  topic: 200,
  notes: 1500,
  studentText: 6000,
};

const MAX_TOKENS = {
  lesson: 1400,
  feedback: 900,
  worksheet: 900,
  mcq: 900,
  slides_pack: 1300,
};

const RESOURCE_LIMITS = {
  worksheet: { min: 6, max: 20 },
  mcq: { min: 6, max: 15 },
  slides_pack: { min: 8, max: 18 },
};

const requestSchema = z.object({
  mode: z.enum(["lesson", "resource", "feedback"]),
  topic: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  grade: z.string().optional().default(""),
  year_group: z.string().optional().default(""),
  lesson_type: z
    .enum(["New concept", "Revision & practice", "Exam prep"])
    .optional()
    .default("New concept"),
  duration: z.enum(["60", "90"]).optional().default("60"),
  class_ability: z.enum(["Low", "Medium", "High", "Mixed"]).optional().default("Mixed"),
  class_profile: z.string().optional().default(""),
  curriculum_key: z.string().optional().default("national_pk"),
  prior_learning: z.string().optional().default(""),
  resource_type: z.string().optional().default(""),
  resource_count: z.coerce.number().int().optional(),
  number_questions: z.coerce.number().int().optional(),
  assessment_type: z.string().optional().default(""),
  total_marks: z.string().optional().default(""),
  rubric: z.string().optional().default(""),
  question_text: z.string().optional().default(""),
  student_text: z.string().optional().default(""),
  refine_request: z.string().optional().default(""),
});

type ResourceKind = "worksheet" | "mcq" | "slides_pack";

const resourcePrompts: Record<ResourceKind, string> = {
  worksheet: worksheetPrompt,
  mcq: mcqPrompt,
  slides_pack: slidesPackPrompt,
};

const truncateText = (value: string, max: number) =>
  value.length > max ? value.slice(0, max) : value;

const stripMarkdownFence = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
};

const extractJson = (value: string) => {
  const cleaned = stripMarkdownFence(value);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return cleaned.slice(start, end + 1);
};

const parseOutput = <T>(schema: z.ZodType<T>, value: string) => {
  const extracted = extractJson(value) ?? value;
  try {
    const parsed = JSON.parse(extracted);
    return schema.safeParse(parsed);
  } catch {
    return schema.safeParse(null);
  }
};

const mergeCitations = (primary: Citation[], secondary: Citation[]) => {
  const map = new Map<string, Citation>();
  [...primary, ...secondary].forEach((citation) => {
    const key = `${citation.source}::${citation.excerpt}`;
    if (!map.has(key)) {
      map.set(key, citation);
    }
  });
  return Array.from(map.values());
};

const footerLine = "© NexAura. For school use only.";

const applyFooter = (output: { sections: { content: string }[] }) => {
  if (output.sections.length === 0) return output;
  const updatedSections = output.sections.map((section, index) => {
    if (index !== output.sections.length - 1) return section;
    const content = section.content.trimEnd();
    if (content.endsWith(footerLine)) {
      return section;
    }
    return {
      ...section,
      content: `${content}\n\n${footerLine}`.trim(),
    };
  });
  return { ...output, sections: updatedSections };
};

const logUsageSafely = async (payload: Parameters<typeof logUsageEvent>[0]) => {
  try {
    await logUsageEvent(payload);
  } catch (error) {
    console.error("Usage logging failed", error);
  }
};

const normalizeResourceType = (value: string): ResourceKind | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "worksheet") return "worksheet";
  if (normalized === "mcq" || normalized === "mcq quiz") return "mcq";
  if (normalized === "slides_pack" || normalized === "slides content pack") {
    return "slides_pack";
  }
  return null;
};

const getResourceSchema = (kind: ResourceKind) => {
  switch (kind) {
    case "worksheet":
      return WorksheetResourceSchema;
    case "mcq":
      return McqResourceSchema;
    case "slides_pack":
      return SlidesPackResourceSchema;
  }
};

const resourceSchemaText: Record<ResourceKind, string> = {
  worksheet:
    "{\n  \"resource_kind\": \"worksheet\",\n  \"title\": string,\n  \"teacher_instructions\": string,\n  \"questions\": [{ \"number\": int, \"prompt\": string, \"marks\"?: int }],\n  \"answers\": [{ \"number\": int, \"answer\": string }],\n  \"citations\": [{ \"source\": string, \"excerpt\": string }]\n}",
  mcq:
    "{\n  \"resource_kind\": \"mcq\",\n  \"title\": string,\n  \"teacher_instructions\": string,\n  \"questions\": [{ \"number\": int, \"stem\": string, \"options\": [string,string,string,string], \"correct_index\": 0|1|2|3, \"misconception_map\"?: [string,string,string,string] }],\n  \"answer_key\": [{ \"number\": int, \"correct_option\": \"A\"|\"B\"|\"C\"|\"D\" }],\n  \"citations\": [{ \"source\": string, \"excerpt\": string }]\n}",
  slides_pack:
    "{\n  \"resource_kind\": \"slides_pack\",\n  \"title\": string,\n  \"slides\": [{ \"slide_number\": int, \"title\": string, \"bullets\": [string], \"speaker_notes\": string, \"suggested_visual\"?: string, \"check_for_understanding\"?: string }],\n  \"teacher_appendix\": { \"starter_questions\": [{ \"q\": string, \"answer\": string }], \"mini_whiteboard_checks\": [{ \"q\": string, \"expected\": string, \"common_wrong\"?: string }], \"exit_ticket\": { \"q\": string, \"answer\"?: string } },\n  \"citations\": [{ \"source\": string, \"excerpt\": string }]\n}",
};

export const POST = async (request: Request) => {
  const start = Date.now();
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rawTopic = typeof body.topic === "string" ? body.topic : "";
  const rawNotes = typeof body.notes === "string" ? body.notes : "";
  const rawStudentText = typeof body.student_text === "string" ? body.student_text : "";
  const topicTruncated = rawTopic.length > LIMITS.topic;
  const notesTruncated = rawNotes.length > LIMITS.notes;
  const studentTextTruncated = rawStudentText.length > LIMITS.studentText;

  const clampedBody = {
    ...body,
    topic: typeof body.topic === "string" ? truncateText(body.topic, LIMITS.topic) : body.topic,
    notes: typeof body.notes === "string" ? truncateText(body.notes, LIMITS.notes) : body.notes,
    student_text:
      typeof body.student_text === "string"
        ? truncateText(body.student_text, LIMITS.studentText)
        : body.student_text,
  };

  const parsed = requestSchema.safeParse(clampedBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const {
    mode,
    topic,
    notes,
    grade,
    year_group,
    lesson_type,
    duration,
    class_ability,
    class_profile,
    curriculum_key,
    prior_learning,
    resource_type,
    resource_count,
    number_questions,
    assessment_type,
    total_marks,
    rubric,
    question_text,
    student_text,
    refine_request,
  } = parsed.data;

  const gradeLabel = grade || year_group || "";

  if ((mode === "lesson" || mode === "resource") && !topic.trim()) {
    return NextResponse.json({ error: "Topic is required." }, { status: 400 });
  }

  if (mode === "lesson" && !prior_learning.trim()) {
    return NextResponse.json(
      { error: "Prior learning is required for lesson plans." },
      { status: 400 }
    );
  }

  if (mode === "feedback") {
    if (!topic.trim()) {
      // allow topic to be absent for feedback
    }
    if (!question_text.trim() || !student_text.trim()) {
      return NextResponse.json(
        { error: "Question set and student response are required." },
        { status: 400 }
      );
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", sessionData.session.user.id)
    .single();

  const schoolId = profile?.school_id || null;

  const effectiveTopic = topic.trim() ? topic : question_text;

  const normalizedResourceType =
    mode === "resource" ? normalizeResourceType(resource_type) : null;

  if (mode === "resource" && !normalizedResourceType) {
    return NextResponse.json({ error: "Resource type is required." }, { status: 400 });
  }

  if (mode === "resource" && normalizedResourceType === "slides_pack" && !prior_learning.trim()) {
    return NextResponse.json(
      { error: "Prior learning is required for slides content packs." },
      { status: 400 }
    );
  }

  const resourceCountRaw = resource_count ?? number_questions;
  const resourceCount =
    mode === "resource" && resourceCountRaw !== undefined && resourceCountRaw !== null
      ? Number(resourceCountRaw)
      : null;
  let resourceCountClamped = resourceCount;

  if (mode === "resource") {
    if (resourceCount === null) {
      return NextResponse.json(
        { error: "Resource count is required for resources." },
        { status: 400 }
      );
    }
    const count = resourceCount;
    if (!Number.isFinite(count) || !Number.isInteger(count) || count <= 0) {
      return NextResponse.json(
        { error: "Resource count must be a positive whole number." },
        { status: 400 }
      );
    }
    if (normalizedResourceType) {
      const range = RESOURCE_LIMITS[normalizedResourceType];
      if (count < range.min || count > range.max) {
        return NextResponse.json(
          {
            error: `Resource count must be between ${range.min} and ${range.max} for ${normalizedResourceType.replace("_", " ")}.`,
          },
          { status: 400 }
        );
      }
      resourceCountClamped = Math.min(Math.max(count, range.min), range.max);
    }
  }

  const combinedInput = [
    effectiveTopic,
    notes,
    prior_learning,
    question_text,
    student_text,
    refine_request,
  ]
    .filter(Boolean)
    .join(" ");
  const scopeDecision = evaluateScope(mode, combinedInput);

  if (!scopeDecision.allowed) {
    if (schoolId) {
      await logUsageSafely({
        schoolId,
        mode,
        latencyMs: Date.now() - start,
        model: process.env.MODEL_NAME || "gpt-4o-mini",
        tokensEstimate: null,
        costEstimateUsd: null,
        status: "fail",
        repairUsed: false,
        topicLen: rawTopic.length,
        notesLen: rawNotes.length,
        studentTextLen: rawStudentText.length,
      });
    }

    return NextResponse.json({
      title: "Scope guidance",
      sections: [
        {
          heading: "Guidance",
          content: scopeDecision.message,
        },
      ],
      citations: [],
      refusal: true,
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key is missing." },
      { status: 500 }
    );
  }

  if (schoolId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createSupabaseAdminClient();
    const since = new Date();
    since.setMinutes(since.getMinutes() - 5);
    const { count } = await admin
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("created_at", since.toISOString());

    if ((count ?? 0) >= 10) {
      await logUsageSafely({
        schoolId,
        mode,
        latencyMs: Date.now() - start,
        model: process.env.MODEL_NAME || "gpt-4o-mini",
        tokensEstimate: null,
        costEstimateUsd: null,
        status: "rate_limited",
        repairUsed: false,
        topicLen: rawTopic.length,
        notesLen: rawNotes.length,
        studentTextLen: rawStudentText.length,
      });

      return NextResponse.json({
        title: "Rate limit reached",
        sections: [
          {
            heading: "Please wait",
            content:
              "You have reached the demo rate limit (10 requests per 5 minutes). Please wait a moment and try again.",
          },
        ],
        citations: [],
        rateLimited: true,
      });
    }
  }

  const mainQuery =
    mode === "feedback"
      ? `${effectiveTopic} ${gradeLabel} ${assessment_type}`
      : `${effectiveTopic} ${notes} ${gradeLabel} ${lesson_type} ${normalizedResourceType ?? ""}`;
  const starterQuery =
    mode === "lesson" || normalizedResourceType === "slides_pack"
      ? `${prior_learning} ${gradeLabel}`
      : null;

  const { mainSnippets, starterSnippets } = retrieveCurriculumBundles(
    mainQuery,
    starterQuery,
    curriculum_key || "national_pk"
  );

  const curriculumText = mainSnippets.length
    ? mainSnippets
        .map((snippet, index) => `${index + 1}. (${snippet.source}) ${snippet.text}`)
        .join("\n")
    : "No relevant curriculum excerpts found.";

  const starterCurriculumText = starterSnippets.length
    ? starterSnippets
        .map((snippet, index) => `${index + 1}. (${snippet.source}) ${snippet.text}`)
        .join("\n")
    : "No relevant curriculum excerpts found.";

  const limitedCurriculum = mainSnippets.length === 0;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const contextLines = [
    `- Topic: ${effectiveTopic}`,
    gradeLabel ? `- Grade: ${gradeLabel}` : null,
    lesson_type ? `- Lesson type: ${lesson_type}` : null,
    duration ? `- Duration: ${duration}` : null,
    class_ability ? `- Class ability: ${class_ability}` : null,
    class_profile ? `- Class profile: ${class_profile}` : null,
    prior_learning ? `- Prior learning / previous lesson: ${prior_learning}` : null,
    normalizedResourceType ? `- Resource type: ${normalizedResourceType}` : null,
    Number.isFinite(resourceCountClamped)
      ? `- Resource count: ${resourceCountClamped}`
      : null,
    assessment_type ? `- Assessment type: ${assessment_type}` : null,
    total_marks ? `- Total marks: ${total_marks}` : null,
    rubric ? `- Rubric: ${rubric}` : null,
    question_text ? `- Question(s) set: ${question_text}` : null,
    notes ? `- Notes: ${notes}${notesTruncated ? " (truncated)" : ""}` : null,
    mode === "feedback"
      ? `- Student response/work: ${student_text || "None"}${studentTextTruncated ? " (truncated)" : ""}`
      : null,
    topicTruncated ? "- Topic was truncated to fit limits." : null,
    refine_request ? `- Refinement request: ${refine_request}` : null,
  ].filter(Boolean);

  const basePrompt =
    mode === "resource" && normalizedResourceType
      ? resourcePrompts[normalizedResourceType]
      : mode === "lesson"
      ? lessonPlannerPrompt
      : feedbackPrompt;

  const prompt = `${basePrompt}

Context:
${contextLines.join("\n") || "- None"}

Starter curriculum excerpts (prior learning):
${starterCurriculumText}

Main curriculum excerpts (current topic):
${curriculumText}

Output JSON only.`;

  let response: OpenAI.Chat.Completions.ChatCompletion | null = null;
  try {
    response = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens:
        mode === "resource" && normalizedResourceType
          ? MAX_TOKENS[normalizedResourceType]
          : MAX_TOKENS[mode],
      response_format: { type: "json_object" },
    });
  } catch (error) {
    console.error("OpenAI request failed", error);
    if (schoolId) {
      await logUsageSafely({
        schoolId,
        mode,
        latencyMs: Date.now() - start,
        model: process.env.MODEL_NAME || "gpt-4o-mini",
        tokensEstimate: null,
        costEstimateUsd: null,
        status: "fail",
        repairUsed: false,
        topicLen: rawTopic.length,
        notesLen: rawNotes.length,
        studentTextLen: rawStudentText.length,
      });
    }

    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }

  if (!response) {
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }

  const content = response.choices[0]?.message?.content || "";
  const schema =
    mode === "resource" && normalizedResourceType
      ? getResourceSchema(normalizedResourceType)
      : GenericOutputSchema;
  const primaryParse = parseOutput(schema, content);

  let finalOutput: ResourceOutput | z.infer<typeof GenericOutputSchema> | null = null;
  let repairUsed = false;

  if (primaryParse.success) {
    finalOutput = primaryParse.data;
  } else {
    const extracted = extractJson(content) ?? content;
    const schemaText =
      mode === "resource" && normalizedResourceType
        ? resourceSchemaText[normalizedResourceType]
        : "{\n  \"title\": string,\n  \"sections\": [{ \"heading\": string, \"content\": string }],\n  \"citations\": [{ \"source\": string, \"excerpt\": string }]\n}";
    try {
      const repair = await openai.chat.completions.create({
        model: process.env.MODEL_NAME || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a formatter. Convert the input into STRICT JSON that matches the schema exactly.",
          },
          {
            role: "user",
            content: `Schema:\n${schemaText}\n\nInput:\n${extracted}\n\nOutput ONLY JSON.`,
          },
        ],
        temperature: 0,
        max_tokens: 800,
        response_format: { type: "json_object" },
      });

      const repairedContent = repair.choices[0]?.message?.content || "";
      const repairParse = parseOutput(schema, repairedContent);
      if (repairParse.success) {
        finalOutput = repairParse.data;
        repairUsed = true;
      }
    } catch (error) {
      console.error("Repair request failed", error);
    }
  }

  const retrievedCitations = [...starterSnippets, ...mainSnippets].map((snippet) => ({
    source: snippet.source,
    excerpt: snippet.text,
  }));

  if (!finalOutput) {
    if (schoolId) {
      await logUsageSafely({
        schoolId,
        mode,
        latencyMs: Date.now() - start,
        model: response.model,
        tokensEstimate: response.usage?.total_tokens ?? null,
        costEstimateUsd: null,
        status: "parse_fail",
        repairUsed: false,
        topicLen: rawTopic.length,
        notesLen: rawNotes.length,
        studentTextLen: rawStudentText.length,
      });
    }

    if (mode === "resource") {
      return NextResponse.json(
        { error: "Unable to format resource output. Please try again." },
        { status: 500 }
      );
    }

    const truncated = truncateText(content, 2000);
    return NextResponse.json({
      title: "Draft Output",
      sections: [
        {
          heading: "Output",
          content:
            `${
              truncated ||
              "We couldn’t format the response into the required structure. We attempted an automatic repair. If this persists, simplify the topic or try again."
            }\n\n${footerLine}`,
        },
      ],
      citations: retrievedCitations,
      formatWarning: true,
      curriculumWarning: limitedCurriculum,
      message:
        "We couldn’t format the response into the required structure. We attempted an automatic repair. If this persists, simplify the topic or try again.",
    });
  }

  if (mode === "resource") {
    const resourceOutput = finalOutput as ResourceOutput;
    const mergedCitations = mergeCitations(resourceOutput.citations ?? [], retrievedCitations);
    if (schoolId) {
      await logUsageSafely({
        schoolId,
        mode,
        latencyMs: Date.now() - start,
        model: response.model,
        tokensEstimate: response.usage?.total_tokens ?? null,
        costEstimateUsd: null,
        status: "success",
        repairUsed,
        topicLen: rawTopic.length,
        notesLen: rawNotes.length,
        studentTextLen: rawStudentText.length,
      });
    }

    return NextResponse.json({
      ...resourceOutput,
      citations: mergedCitations,
      formatWarning: false,
      repairUsed,
      curriculumWarning: limitedCurriculum,
      debug: {
        resource_kind: resourceOutput.resource_kind,
        curriculum: curriculum_key,
        starter_retrieval_used:
          resourceOutput.resource_kind === "slides_pack" && Boolean(prior_learning.trim()),
      },
    });
  }

  const mergedCitations = mergeCitations(
    (finalOutput as z.infer<typeof GenericOutputSchema>).citations ?? [],
    retrievedCitations
  );
  const finalWithFooter = applyFooter({
    ...(finalOutput as z.infer<typeof GenericOutputSchema>),
    citations: mergedCitations,
  });

  if (schoolId) {
    await logUsageSafely({
      schoolId,
      mode,
      latencyMs: Date.now() - start,
      model: response.model,
      tokensEstimate: response.usage?.total_tokens ?? null,
      costEstimateUsd: null,
      status: "success",
      repairUsed,
      topicLen: rawTopic.length,
      notesLen: rawNotes.length,
      studentTextLen: rawStudentText.length,
    });
  }

  return NextResponse.json({
    title: finalWithFooter.title,
    sections: finalWithFooter.sections,
    citations: mergedCitations,
    formatWarning: false,
    repairUsed,
    curriculumWarning: limitedCurriculum,
  });
};
