const studentAnswerPatterns = [
  "write a model answer",
  "give me the answers",
  "do this homework",
  "solve",
  "answer this question",
  "complete the worksheet",
  "explain to a student",
  "teach me",
  "tutor",
  "as a student",
  "write an essay for",
];

const feedbackCheatingPatterns = [
  "write my answer",
  "submit",
  "final answer",
  "cheat",
];

export interface ScopeDecision {
  allowed: boolean;
  message: string;
}

export const evaluateScope = (mode: string, combinedInput: string): ScopeDecision => {
  const input = combinedInput.toLowerCase();

  if (studentAnswerPatterns.some((pattern) => input.includes(pattern))) {
    return {
      allowed: false,
      message:
        "This demo only supports teacher-facing planning and feedback. I can reframe this into a lesson plan, resource, or feedback summary for teachers instead of providing direct student answers.",
    };
  }

  if (mode === "feedback" && feedbackCheatingPatterns.some((pattern) => input.includes(pattern))) {
    return {
      allowed: false,
      message:
        "I can not generate answers for students to submit. I can provide feedback on a draft or improvement guidance instead.",
    };
  }

  return {
    allowed: true,
    message: "",
  };
};
