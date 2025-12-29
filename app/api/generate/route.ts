import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { retrieveCurriculumSnippets } from "@/lib/curriculum/retrieve";
import { systemPrompt } from "@/lib/prompts/system";
import { lessonPlannerPrompt } from "@/lib/prompts/lessonPlanner";
import { resourceGeneratorPrompt } from "@/lib/prompts/resourceGenerator";
import { feedbackPrompt } from "@/lib/prompts/feedback";
import { evaluateScope } from "@/lib/prompts/scopePolicy";
import { logUsageEvent } from "@/lib/usage/logUsage";

const requestSchema = z.object({
  mode: z.enum(["lesson", "resource", "feedback"]),
  topic: z.string().min(2),
  notes: z.string().optional().default(""),
  year_group: z.string().min(1),
  lesson_type: z.string().min(1),
  duration: z.string().min(1),
  class_ability: z.string().min(1),
  class_profile: z.string().min(1),
  student_text: z.string().optional().default(""),
});

const promptByMode: Record<string, string> = {
  lesson: lessonPlannerPrompt,
  resource: resourceGeneratorPrompt,
  feedback: feedbackPrompt,
};

const parseJsonResponse = (content: string) => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
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
  const parsed = requestSchema.safeParse(body);

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
    student_text,
  } = parsed.data;

  const combinedInput = [topic, notes, student_text].filter(Boolean).join(" ");
  const scopeDecision = evaluateScope(mode, combinedInput);

  if (!scopeDecision.allowed) {
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

  const curriculumSnippets = retrieveCurriculumSnippets(
    `${topic} ${notes} ${year_group} ${lesson_type}`
  );

  const curriculumText = curriculumSnippets.length
    ? curriculumSnippets
        .map((snippet, index) => `${index + 1}. (${snippet.source}) ${snippet.text}`)
        .join("\n")
    : "No relevant curriculum excerpts found.";

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key is missing." },
      { status: 500 }
    );
  }

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
- Notes: ${notes || "None"}
${mode === "feedback" ? `- Student response/work: ${student_text || "None"}` : ""}

Curriculum excerpts:
${curriculumText}

Return JSON only.`;

  let response;
  try {
    response = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });
  } catch (error) {
    console.error("OpenAI request failed", error);
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }

  const content = response?.choices[0]?.message?.content || "";
  const parsedContent = parseJsonResponse(content);

  if (!parsedContent) {
    return NextResponse.json({
      title: "Generation error",
      sections: [
        {
          heading: "Output",
          content:
            "The model response could not be parsed. Please retry with a shorter prompt.",
        },
      ],
      citations: curriculumSnippets.map((snippet) => ({
        source: snippet.source,
        excerpt: snippet.text,
      })),
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", sessionData.session.user.id)
    .single();

  if (profile?.school_id) {
    try {
      await logUsageEvent({
        schoolId: profile.school_id,
        mode,
        latencyMs: Date.now() - start,
        model: response.model,
        tokensEstimate: response.usage?.total_tokens ?? null,
        costEstimateUsd: null,
      });
    } catch (error) {
      console.error("Usage logging failed", error);
    }
  }

  return NextResponse.json({
    title: parsedContent.title || "NexAura Response",
    sections: parsedContent.sections || [],
    citations:
      parsedContent.citations ||
      curriculumSnippets.map((snippet) => ({
        source: snippet.source,
        excerpt: snippet.text,
      })),
  });
};
