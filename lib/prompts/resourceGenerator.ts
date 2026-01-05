export const worksheetPrompt = `You are generating a worksheet. Output MUST be valid JSON with this schema:
{
  "resource_kind": "worksheet",
  "title": string,
  "teacher_instructions": string,
  "questions": [{ "number": int, "prompt": string }],
  "answers": [{ "number": int, "answer": string }]
}

Requirements:
- EXACTLY N questions (use the provided count).
- Teacher instructions MUST be short and say the worksheet should take 20–25 minutes max.
- Teacher instructions MUST include the line: "Differentiation applied: <Low|Medium|High|Mixed>".
- Use Grade (not Year).
- Apply class ability rules:
  - Low: scaffold-heavy with worked example, sentence starters, word bank, more hints, fewer multi-step items.
  - Medium: balanced set with 1–2 multi-step items, light scaffolding, no labeled "Challenge" items.
  - High: 2–3 multi-step/reasoning items near the end, minimal scaffolding, extension prompts allowed.
  - Mixed: balanced mix with optional challenge items labeled "Challenge".
- Provide concise model answers for every question.
- Do NOT place "answer" fields inside questions.
- Do NOT include citations or any extra keys.
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
  - Low: scaffold-heavy, simpler language, more hints.
  - Medium: core pathway with light scaffolding, standard difficulty.
  - High: minimal scaffolding, deeper reasoning, extension prompts.
  - Mixed: balanced mix with optional challenge variants.
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
      "speaker_notes"?: string
    }
  ]
}

Slide requirements (STRICT):
- EXACTLY 12 slides (numbered).
- Slide 1: title/aim.
- Slide 2: starter questions prompt (answers go in speaker notes).
- Slide 3: objectives + success criteria.
- For 60 minutes: include 2 main instruction chunks; for 90 minutes: include 3 chunks.
  Each chunk must be followed by a mini whiteboard check slide.
- Include a slide for individual practice instructions.
- Include a slide for marking/feedback routines.
- Final slide is the exit ticket prompt.
- Bullets must be slide-ready phrases (max ~8 words each).
- Bullets must be student-facing content (facts, definitions, examples).
- Do NOT use planning verbs in bullets: introduce, discuss, use, ask, show, tell.
- Planning/teacher actions must be in speaker_notes only.
- Speaker notes ONLY for starter, instruction, AfL, practice, and exit slides (not on title/objectives/keywords).
- Starter/MWB/Exit speaker notes MUST include:
  Expected answers:
  1) ...
  2) ...
- Include at least 2 main instruction chunks + AfL checks.
- Include ONE independent practice slide (longer practice).
- After Independent Practice, ONLY allow marking/feedback routine + exit ticket (optional brief plenary/summary). No main instruction after Independent Practice.

Other requirements:
- Use Grade (not Year).
- Apply class ability rules:
  - Low: scaffold-heavy with worked example, sentence starters, word bank, clear modeling.
  - Medium (core pathway): standard slide structure, light scaffolding only (max one hint box OR one model sentence stem), include at least one misconception-check AfL question, no Extension/Challenge slide.
  - High: minimal scaffolding, deeper reasoning prompts, include a dedicated Extension/Challenge slide.
  - Mixed: core + optional challenge on the same slide, minimal scaffolds (not low-level).
- Do NOT include worksheet/MCQ formatting.
- If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions.
Output JSON only.`;
