import { NextResponse } from "next/server";
import { Document, Footer, Packer, Paragraph, TextRun } from "docx";
import { z } from "zod";

const requestSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  mode: z.string().min(1),
  sections: z.array(
    z.object({
      heading: z.string().min(1),
      content: z.string().min(1),
    })
  ),
  slides: z
    .array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(1),
        speakerNotes: z.string().min(1),
        suggestedVisual: z.string().optional(),
        checkForUnderstanding: z.string().optional(),
      })
    )
    .optional(),
  citations: z
    .array(
      z.object({
        source: z.string().min(1),
        excerpt: z.string().min(1),
      })
    )
    .optional()
    .default([]),
});

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

  const { title, topic, mode, sections, citations, slides } = parsed.data;
  const date = new Date().toISOString().slice(0, 10);
  const filename = `NexAura_${sanitizeFilename(mode)}_${sanitizeFilename(
    topic
  )}_${date}.docx`;

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
      ...buildParagraphs(section.content)
    );
  });

  if (slides && slides.length > 0) {
    content.push(
      new Paragraph({
        children: [new TextRun({ text: "Slides content pack", bold: true, size: 24 })],
        spacing: { before: 360, after: 120 },
      })
    );

    slides.forEach((slide, index) => {
      content.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Slide ${index + 1}: ${slide.title}`, bold: true }),
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
      if (slide.checkForUnderstanding) {
        content.push(
          new Paragraph({
            text: `Check for understanding: ${slide.checkForUnderstanding}`,
          })
        );
      }
      if (slide.suggestedVisual) {
        content.push(
          new Paragraph({
            text: `Suggested visual: ${slide.suggestedVisual}`,
          })
        );
      }
      content.push(new Paragraph({ text: `Speaker notes: ${slide.speakerNotes}` }));
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
