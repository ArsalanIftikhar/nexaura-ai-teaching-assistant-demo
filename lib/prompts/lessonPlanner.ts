export const lessonPlannerPrompt = `You are generating a UK PGCE-style lesson structure (adapted for Pakistan schools). Output MUST be valid JSON with this schema:
{
  "title": string,
  "sections": [
    { "heading": string, "content": string }
  ],
  "citations": [
    { "source": string, "excerpt": string }
  ]
}

Use the following EXACT section headings and order:
1) Overview
2) Prior Knowledge & Diagnostic
3) Learning Objectives & Success Criteria
4) Key Vocabulary
5) Likely Misconceptions & Fixes
6) Lesson Sequence (Starter / Main input / Guided practice / Independent practice / Wrap-up) with timings adapted to the duration
7) Assessment for Learning (checks for understanding)
8) Differentiation (support + stretch)
9) Resources Needed
10) Exit Ticket

Requirements:
- Use Grade (not Year).
- Prior Knowledge & Diagnostic must be based on the prior learning input (not the current topic).
- Include 3–5 objectives, 3–5 success criteria, 5–10 vocabulary items, 3–6 misconceptions, and 4–6 checks for understanding.
- Include rough timings in minutes that sum to the lesson duration.
- Apply class ability rules:
  - Low: 70/25/5 difficulty mix, step-by-step guidance, sentence starters, more guided examples.
  - Mixed: 50/35/15 difficulty mix.
  - High: 30/40/30 difficulty mix, more reasoning, fewer hints, extension prompts.
- Format objectives, vocabulary, misconceptions, and checks as bullet lines starting with "- ".
- Format the lesson sequence as clear steps with timings, each on a new line.
- End the final section with: "© NexAura. For school use only."
- If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions.
Output JSON only.`;
