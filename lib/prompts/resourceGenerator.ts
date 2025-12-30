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

Include the chosen resource type (Worksheet / Exit ticket / Quiz) within the instructions. If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions. Output JSON only.`;
