export const resourceGeneratorPrompt = `You are generating printable classroom resources. Output MUST be valid JSON with this schema:
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
1) Teacher Instructions
2) Student Sheet (printable)
3) Answers / Marking Guidance (teacher-only)
4) Differentiation (support + extend)

Requirements:
- Use Grade (not Year).
- Use the chosen resource type and number of questions exactly.
- For MCQ quiz, include A–D options and a clear answer key.
- For mini whiteboard questions, keep items short for quick checks.
- End the final section with: "© NexAura. For school use only."
- If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions.
Output JSON only.`;
