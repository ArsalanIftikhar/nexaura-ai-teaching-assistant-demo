export const feedbackPrompt = `You are generating feedback on student work for a teacher to share. Respond in JSON with:
- title
- sections: array of { heading, content }
- citations: array of { source, excerpt }

Include sections:
1) Student Feedback (strengths, next steps, misconceptions, improvement target, extension prompt)
2) Teacher Notes (diagnostics + suggestions)
3) Reminder to remove names/personal data

If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions.`;
