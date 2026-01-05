import { z } from "zod";

export const CitationSchema = z.object({
  source: z.string().min(1),
  excerpt: z.string().min(1),
});

export const GenericOutputSchema = z.object({
  title: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        content: z.string().min(1),
      })
    )
    .min(1),
  citations: z.array(CitationSchema).default([]),
});

export const WorksheetResourceSchema = z.object({
  resource_kind: z.literal("worksheet"),
  title: z.string().min(1),
  teacher_instructions: z.string().min(1),
  questions: z
    .array(
      z.object({
        number: z.number().int().positive(),
        prompt: z.string().min(1),
      })
    )
    .min(1),
  answers: z
    .array(
      z.object({
        number: z.number().int().positive(),
        answer: z.string().min(1),
      })
    )
    .min(1),
  citations: z.array(CitationSchema).default([]),
});

export const McqResourceSchema = z.object({
  resource_kind: z.literal("mcq"),
  title: z.string().min(1),
  teacher_instructions: z.string().min(1),
  questions: z
    .array(
      z.object({
        number: z.number().int().positive(),
        stem: z.string().min(1),
        options: z.array(z.string().min(1)).length(4),
        correct_index: z.number().int().min(0).max(3),
        explanation: z.string().min(1),
      })
    )
    .min(1),
  answer_key: z
    .array(
      z.object({
        number: z.number().int().positive(),
        correct_option: z.enum(["A", "B", "C", "D"]),
      })
    )
    .optional()
    .default([]),
  citations: z.array(CitationSchema).optional().default([]),
});

export const SlidesPackResourceSchema = z.object({
  resource_kind: z.literal("slides_pack"),
  title: z.string().min(1),
  slides: z
    .array(
      z.object({
        slide_number: z.number().int().positive(),
        title: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(1),
        speaker_notes: z.string().min(1),
        suggested_visual: z.string().optional(),
        check_for_understanding: z.string().optional(),
      })
    )
    .min(8)
    .max(18),
  teacher_appendix: z.object({
    starter_questions: z
      .array(
        z.object({
          q: z.string().min(1),
          answer: z.string().min(1),
        })
      )
      .length(4),
    mini_whiteboard_checks: z.array(
      z.object({
        q: z.string().min(1),
        expected: z.string().min(1),
        common_wrong: z.string().min(1).optional(),
      })
    ),
    exit_ticket: z.object({
      q: z.string().min(1),
      answer: z.string().optional(),
    }),
    differentiation_note: z.string().min(1),
  }),
  citations: z.array(CitationSchema).default([]),
});

export const ResourceOutputSchema = z.discriminatedUnion("resource_kind", [
  WorksheetResourceSchema,
  McqResourceSchema,
  SlidesPackResourceSchema,
]);

export type Citation = z.infer<typeof CitationSchema>;
export type GenericOutput = z.infer<typeof GenericOutputSchema>;
export type WorksheetResourceOutput = z.infer<typeof WorksheetResourceSchema>;
export type McqResourceOutput = z.infer<typeof McqResourceSchema>;
export type SlidesPackResourceOutput = z.infer<typeof SlidesPackResourceSchema>;
export type ResourceOutput = z.infer<typeof ResourceOutputSchema>;
