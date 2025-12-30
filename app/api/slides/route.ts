import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import PptxGenJS from "pptxgenjs";
import { retrieveCurriculumSnippets } from "@/lib/curriculum/retrieve";

const requestSchema = z.object({
  topic: z.string().min(2),
  grade: z.string().optional().default(""),
  lesson_type: z.string().optional().default(""),
  duration: z.string().optional().default(""),
  class_ability: z.string().optional().default(""),
  curriculum_key: z.string().optional().default("national_pk"),
  notes: z.string().optional().default(""),
  consistency_lock: z.boolean().optional().default(false),
  topic_session_context: z.string().optional().default(""),
});

const outlineSchema = z.object({
  title: z.string().min(1),
  slides: z
    .array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(1),
      })
    )
    .min(6),
});

type Outline = z.infer<typeof outlineSchema>;

const footerText = "© NexAura. For school use only.";

const buildSlides = (outline: Outline, citations: { source: string; excerpt: string }[]) => {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "NexAura";

  const addFooter = (slide: PptxGenJS.Slide) => {
    slide.addText(footerText, {
      x: 0.3,
      y: 6.9,
      w: 12.7,
      h: 0.3,
      fontSize: 10,
      color: "666666",
      align: "right",
    });
  };

  outline.slides.forEach((slideData, index) => {
    const slide = pptx.addSlide();
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.3,
      w: 12.3,
      h: 0.5,
      fontSize: 28,
      bold: true,
      color: "1F2937",
    });

    slide.addText(
      slideData.bullets.map((item) => `• ${item}`).join("\n"),
      {
        x: 0.8,
        y: 1.2,
        w: 11.8,
        h: 5.3,
        fontSize: 18,
        color: "334155",
        valign: "top",
      }
    );

    addFooter(slide);

    if (index === 0) {
      slide.addText("NexAura", {
        x: 0.5,
        y: 6.5,
        w: 4,
        h: 0.4,
        fontSize: 12,
        color: "6366F1",
      });
    }
  });

  if (citations.length > 0) {
    const slide = pptx.addSlide();
    slide.addText("Curriculum citations", {
      x: 0.5,
      y: 0.3,
      w: 12.3,
      h: 0.5,
      fontSize: 24,
      bold: true,
      color: "1F2937",
    });
    slide.addText(
      citations.map((c) => `• ${c.source}: ${c.excerpt}`).join("\n"),
      {
        x: 0.8,
        y: 1.1,
        w: 11.8,
        h: 5.6,
        fontSize: 14,
        color: "334155",
        valign: "top",
      }
    );
    addFooter(slide);
  }

  return pptx;
};

const buildPrompt = (
  topic: string,
  grade: string,
  lessonType: string,
  duration: string,
  classAbility: string,
  notes: string,
  curriculumText: string,
  topicSessionContext: string
) => `You are generating a slide deck outline for a UK PGCE-style lesson structure (adapted for Pakistan schools).
Return strict JSON only using this schema:
{
  "title": string,
  "slides": [
    { "title": string, "bullets": [string] }
  ]
}

Required slide order:
1) Title slide
2) Learning objectives (3–5)
3) Key vocabulary (5–10)
4) Starter
5) Main input
6) Guided practice
7) Independent practice
8) Wrap-up
9) Assessment for Learning (checks for understanding)
10) Misconceptions & fixes
11) Practice questions
12) Summary + exit question

Context:
- Topic: ${topic}
- Grade: ${grade || ""}
- Lesson type: ${lessonType || ""}
- Duration: ${duration || ""}
- Class ability: ${classAbility || ""}
- Notes: ${notes || "None"}
${topicSessionContext ? `- Lesson context to reuse: ${topicSessionContext}` : ""}

Curriculum excerpts:
${curriculumText}

Output JSON only.`;

export const POST = async (request: Request) => {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const {
    topic,
    grade,
    lesson_type,
    duration,
    class_ability,
    curriculum_key,
    notes,
    topic_session_context,
  } = parsed.data;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key is missing." }, { status: 500 });
  }

  const curriculumSnippets = retrieveCurriculumSnippets(
    `${topic} ${grade} ${lesson_type}`,
    curriculum_key
  );
  const curriculumText = curriculumSnippets.length
    ? curriculumSnippets
        .map((snippet, index) => `${index + 1}. (${snippet.source}) ${snippet.text}`)
        .join("\n")
    : "No relevant curriculum excerpts found.";

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      { role: "system", content: "You generate structured JSON only." },
      {
        role: "user",
        content: buildPrompt(
          topic,
          grade,
          lesson_type,
          duration,
          class_ability,
          notes,
          curriculumText,
          topic_session_context
        ),
      },
    ],
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  let outline: Outline;
  try {
    outline = outlineSchema.parse(JSON.parse(content));
  } catch {
    return NextResponse.json(
      { error: "Unable to parse slide outline." },
      { status: 500 }
    );
  }

  const citations = curriculumSnippets.map((snippet) => ({
    source: snippet.source,
    excerpt: snippet.text,
  }));
  const curriculumWarning = curriculumSnippets.length === 0;

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "json") {
    return NextResponse.json({ outline, citations, curriculumWarning });
  }

  const pptx = buildSlides(outline, citations);
  const buffer = await pptx.write({ outputType: "nodebuffer" });
  const byteArray = Uint8Array.from(buffer as Uint8Array);
  const blob = new Blob([byteArray]);
  const fileName = `NexAura_Slides_${topic.replace(/[^a-z0-9-_]+/gi, "_")}.pptx`;

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename=${fileName}`,
    },
  });
};
