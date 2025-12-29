export const resourceGeneratorPrompt = `You are generating printable classroom resources. Respond in JSON with:
- title
- sections: array of { heading, content }
- citations: array of { source, excerpt }

Include sections:
1) Teacher Instructions
2) Student Instructions
3) Tasks / Questions
4) Answers / Marking Guidance (teacher-only)
5) Differentiation (Simplify / Extend)

Ensure content is teacher-facing and printable. If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions.`;
