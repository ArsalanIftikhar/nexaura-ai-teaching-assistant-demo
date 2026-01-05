export const worksheetPrompt = `You are generating a worksheet. Output MUST be valid JSON with this schema:
{
  "resource_kind": "worksheet",
  "title": string,
  "teacher_instructions": string,
  "questions": [{ "number": int, "prompt": string }],
  "answers": [{ "number": int, "answer": string }],
  "citations": [{ "source": string, "excerpt": string }]
}

Requirements:
- EXACTLY N questions (use the provided count).
- Teacher instructions MUST say the worksheet should take 20–25 minutes max.
- Use Grade (not Year).
- Apply class ability rules:
  - Low: 70/25/5, step-by-step guidance, sentence starters, more examples.
  - Mixed: 50/35/15 balanced mix.
  - High: 30/40/30, fewer hints, deeper reasoning, extension prompts.
- Provide concise model answers for every question.
- Do NOT include slides, speaker notes, or slide language.
- If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions.
Output JSON only.`;

export const mcqPrompt = `You are generating an MCQ quiz. Output MUST be valid JSON with this schema:
{
  "resource_kind": "mcq",
  "title": string,
  "teacher_instructions": string,
  "questions": [
    {
      "number": int,
      "stem": string,
      "options": [string, string, string, string],
      "correct_index": 0|1|2|3,
      "explanation": string
    }
  ]
}

Requirements:
- EXACTLY N MCQs (use the provided count).
- Teacher instructions MUST be short and say the quiz should take 10–15 minutes max.
- Use Grade (not Year).
- Apply class ability rules:
  - Low: 70/25/5, step-by-step guidance, sentence starters, more examples.
  - Mixed: 50/35/15 balanced mix.
  - High: 30/40/30, fewer hints, deeper reasoning, extension prompts.
- Provide 4 options per question and a correct_index.
- Each question must include a one-sentence explanation.
- At least one incorrect option should reflect a common misconception about the topic or prior learning.
- Do NOT include citations, answer_key, misconception_map, or any extra keys.
- Schema enforcement:
  - questions must be numbered 1..N in order.
  - options array length must be exactly 4 for every question.
  - correct_index must be an integer 0–3.
- If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions.
Output JSON only.`;

export const slidesPackPrompt = `You are generating a slides content pack for teachers to paste into PPT/Google Slides. Output MUST be valid JSON with this schema:
{
  "resource_kind": "slides_pack",
  "title": string,
  "slides": [
    {
      "slide_number": int,
      "title": string,
      "bullets": [string],
      "speaker_notes": string,
      "suggested_visual"?: string,
      "check_for_understanding"?: string
    }
  ],
  "teacher_appendix": {
    "starter_questions": [{ "q": string, "answer": string }],
    "mini_whiteboard_checks": [{ "q": string, "expected": string, "common_wrong"?: string }],
    "exit_ticket": { "q": string, "answer"?: string }
  },
  "citations": [{ "source": string, "excerpt": string }]
}

Slide requirements (STRICT):
- EXACTLY N slides (8–18), numbered.
- Slide 1: title/aim.
- Slide 2: starter questions prompt (answers go to appendix).
- Slide 3: objectives + success criteria.
- For 60 minutes: include 2 main instruction chunks; for 90 minutes: include 3 chunks.
  Each chunk must be followed by a mini whiteboard check slide or check_for_understanding text.
- Include a slide for individual practice instructions.
- Include a slide for marking/feedback routines.
- Final slide is the exit ticket prompt.

Teacher appendix (STRICT):
- starter_questions: EXACTLY 4 Qs with answers, based ONLY on prior_learning + starter curriculum excerpts.
- mini_whiteboard_checks: short diagnostic checks aligned to misconceptions.
- exit_ticket: 1 question (+ answer if objective).

Other requirements:
- Use Grade (not Year).
- Apply class ability rules:
  - Low: 70/25/5, step-by-step guidance, sentence starters, more examples.
  - Mixed: 50/35/15 balanced mix.
  - High: 30/40/30, fewer hints, deeper reasoning, extension prompts.
- Do NOT include worksheet/MCQ formatting.
- If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions.
Output JSON only.`;
