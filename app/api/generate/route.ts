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

type ResourceKind = "worksheet" | "mcq" | "slides_pack";
type NonResourceMode = "lesson" | "feedback";

const LIMITS = {
  topic: 200,
  notes: 1500,
  studentText: 6000,
};

const MAX_TOKENS: Record<NonResourceMode | ResourceKind, number> = {
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

const normalizeClassAbility = (value: unknown) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "low") return "Low";
  if (normalized === "medium") return "Medium";
  if (normalized === "high") return "High";
  if (normalized === "mixed") return "Mixed";
  return value;
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
  class_ability: z.preprocess(
    normalizeClassAbility,
    z.enum(["Low", "Medium", "High", "Mixed"]).optional().default("Mixed")
  ),
  class_profile: z.string().optional().default(""),
  curriculum_key: z.string().optional().default("national_pk"),
  prior_learning: z.string().optional().default(""),
  resource_type: z.string().optional().default(""),
  resource_count: z.coerce.number().int().optional(),
  assessment_type: z.string().optional().default(""),
  total_marks: z.string().optional().default(""),
  rubric: z.string().optional().default(""),
  question_text: z.string().optional().default(""),
  student_text: z.string().optional().default(""),
  refine_request: z.string().optional().default(""),
});

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

const parseOutput = <T extends z.ZodTypeAny>(
  schema: T,
  value: string
): z.infer<T> | null => {
  const extracted = extractJson(value) ?? value;
  try {
    const parsed = JSON.parse(extracted);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
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

const normalizeMcq = (parsed: unknown) => {
  if (!parsed || typeof parsed !== "object") {
    return { error: "MCQ payload is not an object." };
  }

  const payload = parsed as Record<string, unknown>;
  const questionsRaw = payload.questions;
  if (!Array.isArray(questionsRaw)) {
    return { error: "MCQ questions must be an array." };
  }

  const normalizedQuestions = questionsRaw.map((question, index) => {
    const item = (question ?? {}) as Record<string, unknown>;
    const stemValue =
      typeof item.stem === "string"
        ? item.stem
        : typeof item.prompt === "string"
        ? item.prompt
        : "";

    const optionsRaw = item.options;
    if (!Array.isArray(optionsRaw)) {
      return { error: "MCQ options must be an array." };
    }
    const options = optionsRaw
      .map((option) => {
        if (typeof option === "string") return option.trim();
        if (option && typeof option === "object") {
          const optionRecord = option as Record<string, unknown>;
          if (typeof optionRecord.text === "string") return optionRecord.text.trim();
          if (typeof optionRecord.label === "string") return optionRecord.label.trim();
        }
        return "";
      })
      .filter(Boolean);

    if (options.length < 4) {
      return { error: "MCQ options must include exactly 4 items." };
    }

    let correctIndex =
      typeof item.correct_index === "number" ? item.correct_index : null;
    if (correctIndex === null && typeof item.correct_option === "string") {
      const letter = item.correct_option.trim().toUpperCase();
      const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
      if (letter in map) correctIndex = map[letter];
    }
    if (correctIndex === null || correctIndex < 0 || correctIndex > 3) {
      return { error: "MCQ correct_index must be 0-3." };
    }

    return {
      number: index + 1,
      stem: stemValue,
      options: options.slice(0, 4),
      correct_index: correctIndex,
      explanation:
        typeof item.explanation === "string"
          ? item.explanation
          : "Explanation unavailable.",
    };
  });

  if (normalizedQuestions.some((q) => "error" in q)) {
    const errorItem = normalizedQuestions.find((q) => "error" in q) as {
      error: string;
    };
    return { error: errorItem.error };
  }

  return {
    value: {
      resource_kind: "mcq",
      title: typeof payload.title === "string" ? payload.title : "MCQ Quiz",
      teacher_instructions:
        typeof payload.teacher_instructions === "string"
          ? payload.teacher_instructions
          : "Complete this quiz in 10–15 minutes.",
      questions: normalizedQuestions,
      answer_key: [],
      citations: [],
    },
  };
};

const applyFooter = (output: z.infer<typeof GenericOutputSchema>) => {
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
    "{\n  \"resource_kind\": \"worksheet\",\n  \"title\": string,\n  \"teacher_instructions\": string,\n  \"questions\": [{ \"number\": int, \"prompt\": string }],\n  \"answers\": [{ \"number\": int, \"answer\": string }],\n  \"citations\": [{ \"source\": string, \"excerpt\": string }]\n}",
  mcq:
    "{\n  \"resource_kind\": \"mcq\",\n  \"title\": string,\n  \"teacher_instructions\": string,\n  \"questions\": [{ \"number\": int, \"stem\": string, \"options\": [string,string,string,string], \"correct_index\": 0|1|2|3, \"explanation\": string }]\n}",
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

  const resourceCountRaw = resource_count;
  const resourceCount =
    mode === "resource" && resourceCountRaw !== undefined && resourceCountRaw !== null
      ? Number(resourceCountRaw)
      : null;
  let resourceCountClamped: number | null = resourceCount;

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
    typeof resourceCountClamped === "number" && Number.isFinite(resourceCountClamped)
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

  const mcqMaxTokens =
    mode === "resource" &&
    normalizedResourceType === "mcq" &&
    typeof resourceCountClamped === "number"
      ? Math.min(4000, 900 + 220 * resourceCountClamped)
      : null;

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

  const resolveMaxTokens = () => {
    if (mode === "resource") {
      const kind: ResourceKind = normalizedResourceType ?? "worksheet";
      if (kind === "mcq" && mcqMaxTokens) {
        return mcqMaxTokens;
      }
      return MAX_TOKENS[kind];
    }
    const nonResourceMode: NonResourceMode = mode;
    return MAX_TOKENS[nonResourceMode];
  };

  let response: OpenAI.Chat.Completions.ChatCompletion | null = null;
  try {
    response = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: resolveMaxTokens(),
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
  let primaryParse = parseOutput(schema, content);
  if (mode === "resource" && normalizedResourceType === "mcq") {
    const extracted = extractJson(content) ?? content;
    try {
      const parsed = JSON.parse(extracted);
      const normalized = normalizeMcq(parsed);
      if ("value" in normalized) {
        const normalizedParse = parseOutput(McqResourceSchema, JSON.stringify(normalized.value));
        if (normalizedParse) {
          primaryParse = normalizedParse;
        } else {
          const result = McqResourceSchema.safeParse(normalized.value);
          if (!result.success) {
            console.error(
              `mcq_zod_issues=${JSON.stringify(result.error.issues).slice(0, 4000)}`
            );
            console.error(`mcq_raw_head=${content.slice(0, 800)}`);
            console.error(`mcq_raw_tail=${content.slice(-800)}`);
          }
        }
      } else {
        console.error(`mcq_zod_issues=${normalized.error}`);
        console.error(`mcq_raw_head=${content.slice(0, 800)}`);
        console.error(`mcq_raw_tail=${content.slice(-800)}`);
      }
    } catch (error) {
      console.error(`mcq_parse_error=${String(error)}`);
      console.error(`mcq_raw_head=${content.slice(0, 800)}`);
      console.error(`mcq_raw_tail=${content.slice(-800)}`);
    }
  }

  let finalOutput: ResourceOutput | z.infer<typeof GenericOutputSchema> | null = null;
  let repairUsed = false;

  if (primaryParse) {
    finalOutput = primaryParse;
  } else {
    const schemaLabel =
      mode === "resource" ? `resource:${normalizedResourceType ?? "unknown"}` : mode;
    console.error(
      `Parse failed for ${schemaLabel}. Raw output: ${content.slice(0, 300)}`
    );

    if (mode === "resource" && normalizedResourceType === "mcq") {
      const extracted = extractJson(content) ?? content;
      let mcqRepairAttempted = false;
      try {
        let mcqIssueSummary = "";
        try {
          const parsedOriginal = JSON.parse(extracted);
          const normalizedOriginal = normalizeMcq(parsedOriginal);
          mcqIssueSummary =
            "value" in normalizedOriginal
              ? (() => {
                  const result = McqResourceSchema.safeParse(normalizedOriginal.value);
                  return result.success
                    ? ""
                    : JSON.stringify(result.error.issues).slice(0, 4000);
                })()
              : normalizedOriginal.error;
        } catch (parseErr) {
          mcqIssueSummary = `json_error: ${String(parseErr)}`;
        }

        const mcqRepair = await openai.chat.completions.create({
          model: process.env.MODEL_NAME || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a formatter. Output STRICT JSON that matches the MCQ schema exactly. Do not add any extra keys.",
            },
            {
              role: "user",
              content: `Schema:\n${resourceSchemaText.mcq}\n\nRules:\n- questions array must be EXACTLY N items and numbered 1..N.\n- options array must include EXACTLY 4 options per question.\n- correct_index must be 0,1,2,or 3.\n- each question must include a one-sentence explanation.\n- Output ONLY the schema fields. No extra keys.\n\nZod issues:\n${mcqIssueSummary || "none"}\n\nInput:\n${extracted}\n\nOutput ONLY JSON.`,
            },
          ],
          temperature: 0,
          max_tokens: 800,
          response_format: { type: "json_object" },
        });

        const repairedContent = mcqRepair.choices[0]?.message?.content || "";
        mcqRepairAttempted = true;
        let repairParse = parseOutput(McqResourceSchema, repairedContent);
        if (!repairParse) {
          try {
            const parsedRepair = JSON.parse(repairedContent);
            const normalizedRepair = normalizeMcq(parsedRepair);
            if ("value" in normalizedRepair) {
              repairParse = parseOutput(
                McqResourceSchema,
                JSON.stringify(normalizedRepair.value)
              );
            }
          } catch (parseErr) {
            console.error(`mcq_parse_error=${String(parseErr)}`);
          }
        }
        if (repairParse) {
          finalOutput = repairParse;
          repairUsed = true;
        } else {
          console.error(
            `MCQ repair failed. Raw output: ${repairedContent.slice(0, 300)}`
          );
          console.error(`mcq_raw_head=${repairedContent.slice(0, 800)}`);
          console.error(`mcq_raw_tail=${repairedContent.slice(-800)}`);
          const shouldDebug =
            process.env.NODE_ENV !== "production" ||
            process.env.DEBUG_GENERATION === "1";
          let debugPayload: Record<string, unknown> = {};
          if (shouldDebug) {
            let parseError: unknown = null;
            try {
              const parsedRepair = JSON.parse(repairedContent);
              const normalizedRepair = normalizeMcq(parsedRepair);
              if ("value" in normalizedRepair) {
                const result = McqResourceSchema.safeParse(normalizedRepair.value);
                parseError = result.success
                  ? null
                  : JSON.stringify(result.error.issues).slice(0, 4000);
                if (!result.success) {
                  console.error(
                    `mcq_zod_issues=${JSON.stringify(result.error.issues).slice(0, 4000)}`
                  );
                }
              } else {
                parseError = normalizedRepair.error;
                console.error(`mcq_zod_issues=${normalizedRepair.error}`);
              }
            } catch (parseErr) {
              parseError = { json_error: String(parseErr) };
              console.error(`mcq_zod_issues=${String(parseErr)}`);
            }
            debugPayload = {
              debug_zod_issues: parseError,
              debug_raw_head: repairedContent.slice(0, 800),
              debug_raw_tail: repairedContent.slice(-800),
              debug_repair_used: mcqRepairAttempted,
            };
          }
          return NextResponse.json(
            {
              error: "Unable to format MCQ output. Please try again.",
              ...debugPayload,
            },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error("MCQ repair request failed", error);
        console.error(`mcq_raw_head=${extracted.slice(0, 800)}`);
        console.error(`mcq_raw_tail=${extracted.slice(-800)}`);
        const shouldDebug =
          process.env.NODE_ENV !== "production" ||
          process.env.DEBUG_GENERATION === "1";
        let debugPayload: Record<string, unknown> = {};
        if (shouldDebug) {
          let parseError: unknown = null;
          try {
            const parsedRepair = JSON.parse(extracted);
            const normalizedRepair = normalizeMcq(parsedRepair);
            if ("value" in normalizedRepair) {
              const result = McqResourceSchema.safeParse(normalizedRepair.value);
              parseError = result.success
                ? null
                : JSON.stringify(result.error.issues).slice(0, 4000);
            } else {
              parseError = normalizedRepair.error;
            }
          } catch (parseErr) {
            parseError = { json_error: String(parseErr) };
          }
          debugPayload = {
            debug_zod_issues: parseError,
            debug_raw_head: extracted.slice(0, 800),
            debug_raw_tail: extracted.slice(-800),
            debug_repair_used: mcqRepairAttempted,
          };
        }
        return NextResponse.json(
          {
            error: "MCQ formatting repair failed. Please try again.",
            ...debugPayload,
          },
          { status: 500 }
        );
      }
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
        if (repairParse) {
          finalOutput = repairParse;
          repairUsed = true;
        }
      } catch (error) {
        console.error("Repair request failed", error);
      }
    }
  }

  const retrievedCitations = [...starterSnippets, ...mainSnippets].map((snippet) => ({
    source: snippet.source,
    excerpt: snippet.text,
  }));

  if (
    mode === "resource" &&
    normalizedResourceType === "worksheet" &&
    resourceCountClamped !== null &&
    finalOutput &&
    (finalOutput as ResourceOutput).resource_kind === "worksheet"
  ) {
    const worksheetOutput = finalOutput as z.infer<typeof WorksheetResourceSchema>;
    const targetCount = resourceCountClamped;
    const existingQuestions = worksheetOutput.questions ?? [];
    const existingAnswers = worksheetOutput.answers ?? [];

    let adjustedQuestions = existingQuestions.slice(0, targetCount);
    let adjustedAnswers = existingAnswers.slice(0, targetCount);

    if (adjustedQuestions.length < targetCount) {
      const missingCount = targetCount - adjustedQuestions.length;
      const repairPrompt = `Add ${missingCount} NEW worksheet questions and answers to reach exactly ${targetCount} total.\n\nExisting questions:\n${adjustedQuestions
        .map((q) => `${q.number}. ${q.prompt}`)
        .join("\n")}\n\nExisting answers:\n${adjustedAnswers
        .map((a) => `${a.number}. ${a.answer}`)
        .join("\n")}\n\nOutput ONLY JSON matching this schema:\n{\n  \"resource_kind\": \"worksheet\",\n  \"questions\": [{ \"number\": int, \"prompt\": string }],\n  \"answers\": [{ \"number\": int, \"answer\": string }]\n}`;

      try {
        const repair = await openai.chat.completions.create({
          model: process.env.MODEL_NAME || "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a formatter that adds missing items only." },
            { role: "user", content: repairPrompt },
          ],
          temperature: 0,
          max_tokens: 600,
          response_format: { type: "json_object" },
        });

        const repairContent = repair.choices[0]?.message?.content || "";
        const repairSchema = z.object({
          resource_kind: z.literal("worksheet"),
          questions: z.array(
            z.object({
              number: z.number().int().positive(),
              prompt: z.string().min(1),
            })
          ),
          answers: z.array(
            z.object({
              number: z.number().int().positive(),
              answer: z.string().min(1),
            })
          ),
        });

        const repairParsed = parseOutput(repairSchema, repairContent);
        if (repairParsed) {
          const newQuestions = repairParsed.questions.slice(0, missingCount);
          const newAnswers = repairParsed.answers.slice(0, missingCount);
          const startNumber = adjustedQuestions.length + 1;

          adjustedQuestions = [
            ...adjustedQuestions,
            ...newQuestions.map((q, index) => ({
              number: startNumber + index,
              prompt: q.prompt,
            })),
          ];
          adjustedAnswers = [
            ...adjustedAnswers,
            ...newAnswers.map((a, index) => ({
              number: startNumber + index,
              answer: a.answer,
            })),
          ];
        }
      } catch (error) {
        console.error("Worksheet repair failed", error);
      }
    }

    finalOutput = {
      ...worksheetOutput,
      questions: adjustedQuestions.slice(0, targetCount),
      answers: adjustedAnswers.slice(0, targetCount),
    };
  }

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
    const resourceWithDerived =
      resourceOutput.resource_kind === "mcq"
        ? {
            ...resourceOutput,
            answer_key: resourceOutput.questions.map((question, index) => {
              const letters = ["A", "B", "C", "D"] as const;
              const correctOption =
                typeof question.correct_index === "number" &&
                question.correct_index >= 0 &&
                question.correct_index <= 3
                  ? letters[question.correct_index]
                  : "A";
              return {
                number: question.number ?? index + 1,
                correct_option: correctOption,
              };
            }),
          }
        : resourceOutput;
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
      ...resourceWithDerived,
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
