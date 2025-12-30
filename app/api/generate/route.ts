import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { retrieveCurriculumSnippets } from "@/lib/curriculum/retrieve";
import { systemPrompt } from "@/lib/prompts/system";
import { lessonPlannerPrompt } from "@/lib/prompts/lessonPlanner";
import { resourceGeneratorPrompt } from "@/lib/prompts/resourceGenerator";
import { feedbackPrompt } from "@/lib/prompts/feedback";
import { evaluateScope } from "@/lib/prompts/scopePolicy";
import { logUsageEvent } from "@/lib/usage/logUsage";
import { OutputSchema, type OutputPayload } from "@/lib/validators/output";

const LIMITS = {
  topic: 200,
  notes: 1500,
  studentText: 6000,
};

const MAX_TOKENS: Record<string, number> = {
  lesson: 1400,
  resource: 1200,
  feedback: 900,
};

const requestSchema = z.object({
  mode: z.enum(["lesson", "resource", "feedback"]),
  topic: z.string().min(2),
  notes: z.string().optional().default(""),
  year_group: z.string().min(1),
  lesson_type: z.string().min(1),
  duration: z.string().min(1),
  class_ability: z.string().min(1),
  class_profile: z.string().min(1),
  resource_type: z.string().optional().default(""),
  assessment_type: z.string().optional().default(""),
  total_marks: z.string().optional().default(""),
  rubric: z.string().optional().default(""),
  teacher_guidance: z.string().optional().default(""),
  student_text: z.string().optional().default(""),
  refine_request: z.string().optional().default(""),
});

const promptByMode: Record<string, string> = {
  lesson: lessonPlannerPrompt,
  resource: resourceGeneratorPrompt,
  feedback: feedbackPrompt,
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

const parseOutput = (value: string) => {
  const extracted = extractJson(value) ?? value;
  try {
    const parsed = JSON.parse(extracted);
    return OutputSchema.safeParse(parsed);
  } catch {
    return OutputSchema.safeParse(null);
  }
};

const mergeCitations = (
  primary: OutputPayload["citations"],
  secondary: OutputPayload["citations"]
) => {
  const map = new Map<string, { source: string; excerpt: string }>();
  [...primary, ...secondary].forEach((citation) => {
    const key = `${citation.source}::${citation.excerpt}`;
    if (!map.has(key)) {
      map.set(key, citation);
    }
  });
  return Array.from(map.values());
};

const logUsageSafely = async (payload: Parameters<typeof logUsageEvent>[0]) => {
  try {
    await logUsageEvent(payload);
  } catch (error) {
    console.error("Usage logging failed", error);
  }
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
    year_group,
    lesson_type,
    duration,
    class_ability,
    class_profile,
    resource_type,
    assessment_type,
    total_marks,
    rubric,
    teacher_guidance,
    student_text,
    refine_request,
  } = parsed.data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", sessionData.session.user.id)
    .single();

  const schoolId = profile?.school_id || null;

  const combinedInput = [topic, notes, student_text, refine_request]
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

  const curriculumSnippets = retrieveCurriculumSnippets(
    `${topic} ${notes} ${year_group} ${lesson_type}`
  );

  const curriculumText = curriculumSnippets.length
    ? curriculumSnippets
        .map((snippet, index) => `${index + 1}. (${snippet.source}) ${snippet.text}`)
        .join("\n")
    : "No relevant curriculum excerpts found.";

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `${promptByMode[mode]}

Context:
- Topic: ${topic}
- Year group: ${year_group}
- Lesson type: ${lesson_type}
- Duration: ${duration}
- Class ability: ${class_ability}
- Class profile: ${class_profile}
- Resource type: ${resource_type || "N/A"}
- Assessment type: ${assessment_type || "N/A"}
- Total marks: ${total_marks || "N/A"}
- Rubric: ${rubric || "None"}
- Teacher guidance: ${teacher_guidance || "None"}
- Notes: ${notes || "None"}${notesTruncated ? " (truncated)" : ""}
${mode === "feedback" ? `- Student response/work: ${student_text || "None"}${studentTextTruncated ? " (truncated)" : ""}` : ""}
${topicTruncated ? "- Topic was truncated to fit limits." : ""}
${refine_request ? `- Refinement request: ${refine_request}` : ""}

Curriculum excerpts:
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
      max_tokens: MAX_TOKENS[mode],
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
  const primaryParse = parseOutput(content);

  let finalOutput: OutputPayload | null = null;
  let repairUsed = false;

  if (primaryParse.success) {
    finalOutput = primaryParse.data;
  } else {
    const extracted = extractJson(content) ?? content;
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
            content: `Schema:\n{\n  \"title\": string,\n  \"sections\": [{ \"heading\": string, \"content\": string }],\n  \"citations\": [{ \"source\": string, \"excerpt\": string }]\n}\n\nInput:\n${extracted}\n\nOutput ONLY JSON.`,
          },
        ],
        temperature: 0,
        max_tokens: 800,
        response_format: { type: "json_object" },
      });

      const repairedContent = repair.choices[0]?.message?.content || "";
      const repairParse = parseOutput(repairedContent);
      if (repairParse.success) {
        finalOutput = repairParse.data;
        repairUsed = true;
      }
    } catch (error) {
      console.error("Repair request failed", error);
    }
  }

  const retrievedCitations = curriculumSnippets.map((snippet) => ({
    source: snippet.source,
    excerpt: snippet.text,
  }));

  if (!finalOutput) {
    const truncated = truncateText(content, 2000);

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

    return NextResponse.json({
      title: "Draft Output",
      sections: [
        {
          heading: "Output",
          content:
            truncated ||
            "We couldn’t format the response into the required structure. We attempted an automatic repair. If this persists, simplify the topic or try again.",
        },
      ],
      citations: retrievedCitations,
      formatWarning: true,
      message:
        "We couldn’t format the response into the required structure. We attempted an automatic repair. If this persists, simplify the topic or try again.",
    });
  }

  const mergedCitations = mergeCitations(finalOutput.citations ?? [], retrievedCitations);

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
    title: finalOutput.title,
    sections: finalOutput.sections,
    citations: mergedCitations,
    formatWarning: false,
    repairUsed,
  });
};
