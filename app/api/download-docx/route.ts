import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun } from "docx";
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
});

const sanitizeFilename = (value: string) =>
  value.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50);

export const POST = async (request: Request) => {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { title, topic, mode, sections } = parsed.data;
  const date = new Date().toISOString().slice(0, 10);
  const filename = `NexAura_${sanitizeFilename(mode)}_${sanitizeFilename(
    topic
  )}_${date}.docx`;

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 32 })],
          }),
          ...sections.flatMap((section) => [
            new Paragraph({
              children: [
                new TextRun({ text: section.heading, bold: true, size: 24 }),
              ],
            }),
            new Paragraph({ text: section.content }),
          ]),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

// Convert Buffer -> Uint8Array view (no copy)
const docxBytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

return new Response(docxBytes, {
  status: 200,
  headers: {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  },
});
};
