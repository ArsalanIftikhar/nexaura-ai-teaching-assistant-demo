import { NextResponse } from "next/server";
import { z } from "zod";
import JSZip from "jszip";
import OpenAI from "openai";
import PptxGenJS from "pptxgenjs";
import { Document, Footer, Packer, Paragraph, TextRun } from "docx";
import { lessonPlannerPrompt } from "@/lib/prompts/lessonPlanner";
import { resourceGeneratorPrompt } from "@/lib/prompts/resourceGenerator";
import { OutputSchema, type OutputPayload } from "@/lib/validators/output";
import { retrieveCurriculumSnippets } from "@/lib/curriculum/retrieve";

const requestSchema = z.object({
  topic: z.string().min(1),
  grade: z.string().optional().default(""),
  curriculum_key: z.string().optional().default("national_pk"),
  lesson: OutputSchema.optional(),
  resource: OutputSchema.optional(),
  slides: z
    .object({
      title: z.string(),
      slides: z.array(z.object({ title: z.string(), bullets: z.array(z.string()) })),
    })
    .optional(),
  basePayload: z.record(z.string(), z.any()).optional(),
});

const footerText = "© NexAura. For school use only.";

const promptByMode: Record<"lesson" | "resource", string> = {
  lesson: lessonPlannerPrompt,
  resource: resourceGeneratorPrompt,
};

const applyFooter = (output: OutputPayload) => {
  if (output.sections.length === 0) return output;
  const updated = output.sections.map((section, index) => {
    if (index !== output.sections.length - 1) return section;
    const content = section.content.trimEnd();
    if (content.endsWith(footerText)) return section;
    return { ...section, content: `${content}\n\n${footerText}`.trim() };
  });
  return { ...output, sections: updated };
};

const extractJson = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return value.slice(start, end + 1);
};

const generateOutput = async (
  mode: "lesson" | "resource",
  topic: string,
  grade: string,
  payload: Record<string, unknown>,
  curriculumKey: string
) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is missing.");
  }

  const curriculumSnippets = retrieveCurriculumSnippets(
    `${topic} ${grade}`,
    curriculumKey
  );
  const curriculumText = curriculumSnippets.length
    ? curriculumSnippets
        .map((snippet, index) => `${index + 1}. (${snippet.source}) ${snippet.text}`)
        .join("\n")
    : "No relevant curriculum excerpts found.";

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `${promptByMode[mode]}

Context:
- Topic: ${topic}
- Grade: ${grade}
- Resource type: ${payload.resource_type || ""}
- Number of questions: ${payload.number_questions || ""}
- Notes: ${payload.notes || "None"}

Curriculum excerpts:
${curriculumText}

Output JSON only.`;

  const response = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      { role: "system", content: "Return strict JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: mode === "lesson" ? 1200 : 900,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  const cleaned = extractJson(content) || content;
  const parsed = OutputSchema.safeParse(JSON.parse(cleaned));
  if (!parsed.success) {
    throw new Error("Unable to parse generated output.");
  }

  return {
    output: applyFooter(parsed.data),
    citations: curriculumSnippets.map((snippet) => ({
      source: snippet.source,
      excerpt: snippet.text,
    })),
  };
};

const buildDocx = async (title: string, sections: OutputPayload["sections"], citations: OutputPayload["citations"]) => {
  const content: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32 })],
    }),
  ];

  sections.forEach((section) => {
    content.push(
      new Paragraph({
        children: [new TextRun({ text: section.heading, bold: true, size: 24 })],
        spacing: { before: 240, after: 120 },
      }),
      new Paragraph({ text: section.content })
    );
  });

  if (citations.length > 0) {
    content.push(
      new Paragraph({
        children: [new TextRun({ text: "Curriculum citations", bold: true, size: 24 })],
        spacing: { before: 360, after: 120 },
      })
    );
    citations.forEach((citation) => {
      content.push(new Paragraph({ text: `${citation.source}: ${citation.excerpt}` }));
    });
  }

  const doc = new Document({
    sections: [
      {
        children: content,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [new TextRun({ text: footerText, size: 18 })],
              }),
            ],
          }),
        },
      },
    ],
  });

  return Packer.toBuffer(doc);
};

const buildSlides = (outline: { title: string; slides: { title: string; bullets: string[] }[] }, citations: OutputPayload["citations"]) => {
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

  outline.slides.forEach((slideData) => {
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
    slide.addText(slideData.bullets.map((item) => `• ${item}`).join("\n"), {
      x: 0.8,
      y: 1.2,
      w: 11.8,
      h: 5.3,
      fontSize: 18,
      color: "334155",
      valign: "top",
    });
    addFooter(slide);
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

const slideOutlinePrompt = (topic: string, grade: string, curriculumText: string) => `Create a slide outline for a lesson.\nReturn strict JSON only:\n{\n  \"title\": string,\n  \"slides\": [\n    { \"title\": string, \"bullets\": [string] }\n  ]\n}\n\nRequired slide order:\n1) Title slide\n2) Learning objectives (3–5)\n3) Key vocabulary (5–10)\n4) Starter\n5) Main input\n6) Guided practice\n7) Independent practice\n8) Wrap-up\n9) Assessment for Learning (checks for understanding)\n10) Misconceptions & fixes\n11) Practice questions\n12) Summary + exit question\n\nContext:\n- Topic: ${topic}\n- Grade: ${grade}\n\nCurriculum excerpts:\n${curriculumText}\n\nOutput JSON only.`;

export const POST = async (request: Request) => {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { topic, grade, curriculum_key, lesson, resource, slides, basePayload } = parsed.data;

  let lessonOutput = lesson;
  let resourceOutput = resource;

  if (!lessonOutput) {
    const generated = await generateOutput("lesson", topic, grade, basePayload || {}, curriculum_key);
    lessonOutput = generated.output;
  }

  if (!resourceOutput) {
    const generated = await generateOutput("resource", topic, grade, basePayload || {}, curriculum_key);
    resourceOutput = generated.output;
  }

  if (lessonOutput) {
    lessonOutput = applyFooter(lessonOutput);
  }
  if (resourceOutput) {
    resourceOutput = applyFooter(resourceOutput);
  }

  const citations = [...(lessonOutput?.citations || []), ...(resourceOutput?.citations || [])];

  const docxLesson = await buildDocx(
    lessonOutput?.title || "Lesson Plan",
    lessonOutput?.sections || [],
    citations
  );
  const docxResource = await buildDocx(
    resourceOutput?.title || "Resources",
    resourceOutput?.sections || [],
    citations
  );

  const zip = new JSZip();
  const safeTopic = topic.replace(/[^a-z0-9-_]+/gi, "_");
  zip.file(`LessonPlan_${safeTopic}.docx`, docxLesson);
  zip.file(`Resources_${safeTopic}.docx`, docxResource);

  let slideOutline = slides;
  if (!slideOutline) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is missing.");
    }
    const curriculumSnippets = retrieveCurriculumSnippets(
      `${topic} ${grade}`,
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
        { role: "system", content: "Return strict JSON only." },
        { role: "user", content: slideOutlinePrompt(topic, grade, curriculumText) },
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content || "{}";
    slideOutline = JSON.parse(content) as { title: string; slides: { title: string; bullets: string[] }[] };
  }

  if (slideOutline) {
    const pptx = buildSlides(slideOutline, citations);
    const pptxBuffer = await pptx.write({ outputType: "nodebuffer" });
    zip.file(`Slides_${safeTopic}.pptx`, pptxBuffer);
  }

  const citationsText = citations
    .map((c) => `${c.source}: ${c.excerpt}`)
    .join("\n");
  zip.file(`Citations_${safeTopic}.txt`, `${citationsText}\n${footerText}\n`);

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const byteArray = Uint8Array.from(zipBuffer);
  const blob = new Blob([byteArray]);

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=NexAura_Pack_${safeTopic}.zip`,
    },
  });
};
