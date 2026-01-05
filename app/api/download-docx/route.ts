import { NextResponse } from "next/server";
import { Document, Footer, Packer, Paragraph, TextRun } from "docx";
import { z } from "zod";
import { CitationSchema, ResourceOutputSchema } from "@/lib/validators/output";

const baseSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  mode: z.enum(["lesson", "resource", "feedback"]),
  citations: z.array(CitationSchema).optional().default([]),
});

const lessonFeedbackSchema = baseSchema.extend({
  mode: z.enum(["lesson", "feedback"]),
  sections: z.array(
    z.object({
      heading: z.string().min(1),
      content: z.string().min(1),
    })
  ),
});

const resourceSchema = baseSchema.extend({
  mode: z.literal("resource"),
  resource: ResourceOutputSchema,
});

const requestSchema = z.union([lessonFeedbackSchema, resourceSchema]);

const sanitizeFilename = (value: string) =>
  value.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50);

const buildParagraphs = (content: string) => {
  const lines = content.split("\n");
  return lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      return new Paragraph({
        text: trimmed.replace(/^-\s*/, ""),
        bullet: { level: 0 },
      });
    }
    return new Paragraph({ text: trimmed });
  });
};

export const POST = async (request: Request) => {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { title, topic, mode, citations } = parsed.data;
  const date = new Date().toISOString().slice(0, 10);
  const filename = `NexAura_${sanitizeFilename(mode)}_${sanitizeFilename(
    topic
  )}_${date}.docx`;

  const content: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32 })],
    }),
  ];

  if (mode === "resource") {
    const resource = parsed.data.resource;
    if (resource.resource_kind === "worksheet") {
      content.push(
        new Paragraph({
          children: [new TextRun({ text: "Teacher Instructions", bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
        }),
        ...buildParagraphs(resource.teacher_instructions),
        new Paragraph({
          children: [new TextRun({ text: "Questions", bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
        })
      );
      resource.questions.forEach((question) => {
        content.push(
          new Paragraph({
            text: `${question.number}. ${question.prompt}`,
          })
        );
      });
      content.push(
        new Paragraph({
          children: [new TextRun({ text: "Answers", bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
        })
      );
      resource.answers.forEach((answer) => {
        content.push(new Paragraph({ text: `${answer.number}. ${answer.answer}` }));
      });
    }

    if (resource.resource_kind === "mcq") {
      content.push(
        new Paragraph({
          children: [new TextRun({ text: "Teacher Instructions", bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
        }),
        ...buildParagraphs(resource.teacher_instructions),
        new Paragraph({
          children: [new TextRun({ text: "MCQs", bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
        })
      );
      resource.questions.forEach((question) => {
        content.push(new Paragraph({ text: `${question.number}. ${question.stem}` }));
        question.options.forEach((option, index) => {
          const label = String.fromCharCode(65 + index);
          content.push(new Paragraph({ text: `${label}. ${option}` }));
        });
      });
      content.push(
        new Paragraph({
          children: [new TextRun({ text: "Answer Key", bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
        })
      );
      resource.answer_key.forEach((entry) => {
        content.push(new Paragraph({ text: `${entry.number}. ${entry.correct_option}` }));
      });
    }

    if (resource.resource_kind === "slides_pack") {
      content.push(
        new Paragraph({
          children: [new TextRun({ text: "Slides content pack", bold: true, size: 24 })],
          spacing: { before: 360, after: 120 },
        })
      );
      resource.slides.forEach((slide) => {
        content.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Slide ${slide.slide_number}: ${slide.title}`,
                bold: true,
              }),
            ],
            spacing: { before: 240, after: 120 },
          })
        );
        slide.bullets.forEach((bullet) => {
          content.push(
            new Paragraph({
              text: bullet,
              bullet: { level: 0 },
            })
          );
        });
        if (slide.speaker_notes) {
          content.push(new Paragraph({ text: `Speaker notes: ${slide.speaker_notes}` }));
        }
      });

      content.push(
        new Paragraph({
          children: [new TextRun({ text: "Teacher appendix", bold: true, size: 24 })],
          spacing: { before: 360, after: 120 },
        })
      );
      content.push(new Paragraph({ text: resource.teacher_appendix }));
    }
  } else {
    const { sections } = parsed.data;
    sections.forEach((section) => {
      content.push(
        new Paragraph({
          children: [new TextRun({ text: section.heading, bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
        }),
        ...buildParagraphs(section.content)
      );
    });
  }

  if (citations.length > 0) {
    content.push(
      new Paragraph({
        children: [new TextRun({ text: "Curriculum citations", bold: true, size: 24 })],
        spacing: { before: 360, after: 120 },
      })
    );

    citations.forEach((citation) => {
      content.push(
        new Paragraph({
          text: `${citation.source}: ${citation.excerpt}`,
          bullet: { level: 0 },
        })
      );
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
                children: [
                  new TextRun({ text: "© NexAura. For school use only.", size: 18 }),
                ],
              }),
            ],
          }),
        },
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const byteArray = Uint8Array.from(buffer);
  const blob = new Blob([byteArray]);

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
};
