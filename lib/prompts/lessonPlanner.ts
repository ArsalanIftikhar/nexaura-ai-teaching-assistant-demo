export const lessonPlannerPrompt = `You are generating a PGCE-standard lesson plan. Respond in JSON with:
- title
- sections: array of { heading, content }
- citations: array of { source, excerpt }

Include sections:
1) Topic, Year Group, Duration
2) Prior Knowledge / Prerequisite Check
3) Learning Objectives + Success Criteria
4) Misconceptions + How to Address
5) Lesson Sequence (Do Now / I Do / We Do / You Do / Plenary)
6) AFL (hinge questions + checks for understanding)
7) Differentiation (SEND/EAL-friendly adjustments)
8) Resources List
9) Exit Ticket

Ensure content is teacher-facing. If curriculum is missing, include the exact phrase: "Not found in provided curriculum documents" and proceed with safe assumptions.`;
