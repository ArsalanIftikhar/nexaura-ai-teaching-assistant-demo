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
