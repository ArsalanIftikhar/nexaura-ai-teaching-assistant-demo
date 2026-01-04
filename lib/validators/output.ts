import { z } from "zod";

export const OutputSchema = z.object({
  title: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        content: z.string().min(1),
      })
    )
    .min(1),
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
    .default([]),
});

export type OutputPayload = z.infer<typeof OutputSchema>;
