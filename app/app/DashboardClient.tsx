"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Tabs from "@/components/Tabs";
import AppShell from "@/components/AppShell";
import OutputViewer from "@/components/OutputViewer";
import DownloadButton from "@/components/DownloadButton";
import PrivacyWarningModal from "@/components/PrivacyWarningModal";
import ConfirmModal from "@/components/ConfirmModal";
import { SelectField, TextAreaField, TextField } from "@/components/FormControls";
import { containsPii } from "@/lib/validators/pii";

interface Section {
  heading: string;
  content: string;
}

interface SlideContent {
  title: string;
  bullets: string[];
  speakerNotes: string;
  suggestedVisual?: string;
  checkForUnderstanding?: string;
}

interface Citation {
  source: string;
  excerpt: string;
}

interface OutputState {
  title: string;
  sections: Section[];
  slides?: SlideContent[];
  citations: Citation[];
  formatWarning?: boolean;
  curriculumWarning?: boolean;
  message?: string | null;
}

interface DashboardClientProps {
  schoolName: string;
}

type TabKey = "lesson" | "resource" | "feedback";

const STORAGE_CONFIRM_KEY = "nexaura_confirm_no_pii";

const curriculumOptions = [
  { value: "national_pk", label: "National (Pakistan)" },
  { value: "cambridge_lower_secondary", label: "Cambridge Lower Secondary" },
  { value: "oxfordaqa_international", label: "OxfordAQA International" },
];

const gradeOptions = [
  { value: "Grade 7", label: "Grade 7" },
  { value: "Grade 8", label: "Grade 8" },
  { value: "Grade 9", label: "Grade 9" },
];

const lessonTypeOptions = [
  { value: "New concept", label: "New concept" },
  { value: "Revision & practice", label: "Revision & practice" },
  { value: "Exam prep", label: "Exam prep" },
];

const durationOptions = [
  { value: "60", label: "60 minutes" },
  { value: "90", label: "90 minutes" },
];

const abilityOptions = [
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
  { value: "Mixed", label: "Mixed" },
];

const resourceTypeOptions = [
  { value: "Worksheet", label: "Worksheet" },
  { value: "MCQ quiz", label: "MCQ quiz" },
  { value: "Slides content pack", label: "Slides content pack" },
];

const assessmentTypeOptions = [
  { value: "MCQ", label: "MCQ" },
  { value: "Short answer", label: "Short answer" },
  { value: "Extended response", label: "Extended response" },
  { value: "Exam question", label: "Exam question" },
  { value: "Other", label: "Other" },
];

const resourceCountConfig: Record<
  string,
  { min: number; max: number; defaultValue: string; label: string }
> = {
  Worksheet: {
    min: 6,
    max: 20,
    defaultValue: "10",
    label: "Number of questions",
  },
  "MCQ quiz": {
    min: 6,
    max: 15,
    defaultValue: "10",
    label: "Number of questions",
  },
  "Slides content pack": {
    min: 8,
    max: 18,
    defaultValue: "12",
    label: "Number of slides",
  },
};

const summaryByTab: Record<TabKey, { title: string; bullets: string[] }> = {
  lesson: {
    title: "Lesson Plan",
    bullets: [
      "UK PGCE-style lesson structure (adapted for Pakistan schools)",
      "Assessment for Learning (checks for understanding)",
      "Curriculum citations",
    ],
  },
  resource: {
    title: "Resources",
    bullets: [
      "Worksheet, MCQ quiz, slides content pack",
      "Slide content packs for manual slide creation",
      "Suggested external resources",
    ],
  },
  feedback: {
    title: "Feedback",
    bullets: ["Student-friendly feedback", "Teacher notes", "References the question set"],
  },
};

const previewByTab: Record<TabKey, OutputState> = {
  lesson: {
    title: "Sample Lesson Plan: Cells and Specialised Cells",
    sections: [
      {
        heading: "Overview",
        content:
          "Grade 8 science lesson focused on cell structure and specialised cells. UK PGCE-style lesson structure (adapted for Pakistan schools).",
      },
      {
        heading: "Prior Knowledge & Diagnostic",
        content:
          "Starter questions based on prior learning about plant vs animal cells and basic organelles.",
      },
      {
        heading: "Lesson Sequence (Starter / Main input / Guided practice / Independent practice / Wrap-up)",
        content: "Starter 10, Main input 15, Guided practice 15, Independent practice 15, Wrap-up 5.",
      },
    ],
    citations: [
      {
        source: "grade8_science.md",
        excerpt:
          "Identify nucleus, cytoplasm, cell membrane, mitochondria, chloroplasts, and vacuole.",
      },
    ],
  },
  resource: {
    title: "Sample Resource: Worksheet",
    sections: [
      {
        heading: "Teacher Instructions",
        content: "Worksheet (10 questions) aligned to prior learning; time-on-task <= 20 minutes.",
      },
      {
        heading: "Student Sheet (printable)",
        content: "1) Name three organelles.\n2) Explain the job of the nucleus.",
      },
      {
        heading: "Answers / Marking Guidance (teacher-only)",
        content: "Concise model answers with misconceptions noted.",
      },
      {
        heading: "Differentiation (support + extend)",
        content: "Support with word bank; extend with specialised cell examples.",
      },
    ],
    citations: [
      {
        source: "grade8_science.md",
        excerpt:
          "Compare specialized cells (red blood cell, root hair cell, palisade cell).",
      },
    ],
  },
  feedback: {
    title: "Sample Feedback: Diffusion Explanation",
    sections: [
      {
        heading: "Student-Friendly Feedback",
        content:
          "Strengths: Clear definition of diffusion. Next steps: Explain how surface area affects gas exchange.",
      },
      {
        heading: "Teacher Notes",
        content:
          "Misconception: Confuses breathing with respiration. Plan a quick recap using a diagram.",
      },
    ],
    citations: [
      {
        source: "grade8_science.md",
        excerpt:
          "Explain diffusion in alveoli and the role of surface area and blood supply.",
      },
    ],
  },
};

const storageKeyForInputs = (tab: TabKey) => `nexaura_inputs_${tab}`;
const storageKeyForOutput = (tab: TabKey) => `nexaura_output_${tab}`;

interface LessonInputs {
  topic: string;
  grade: string;
  lessonType: string;
  duration: string;
  classAbility: string;
  priorLearning: string;
  curriculumKey: string;
  classProfile: string;
  notes: string;
}

interface ResourceInputs {
  topic: string;
  grade: string;
  curriculumKey: string;
  resourceType: string;
  questionCount: string;
  classAbility: string;
  priorLearning: string;
  notes: string;
}

interface FeedbackInputs {
  grade: string;
  curriculumKey: string;
  assessmentType: string;
  questionText: string;
  studentText: string;
  totalMarks: string;
  rubric: string;
}

const defaultLessonInputs: LessonInputs = {
  topic: "Cells and specialised cells",
  grade: "Grade 8",
  lessonType: "New concept",
  duration: "60",
  classAbility: "Mixed",
  priorLearning: "Basic plant vs animal cells and organelles",
  curriculumKey: "national_pk",
  classProfile: "2 EAL learners; 1 learner needing additional support; varying confidence",
  notes: "",
};

const defaultResourceInputs: ResourceInputs = {
  topic: "Cells and specialised cells",
  grade: "Grade 8",
  curriculumKey: "national_pk",
  resourceType: "Worksheet",
  questionCount: "10",
  classAbility: "Mixed",
  priorLearning: "Basic plant vs animal cells and organelles",
  notes: "",
};

const defaultFeedbackInputs: FeedbackInputs = {
  grade: "Grade 8",
  curriculumKey: "national_pk",
  assessmentType: "Short answer",
  questionText: "Explain how diffusion works in the lungs.",
  studentText: "",
  totalMarks: "",
  rubric: "",
};

const suggestedLinksAllowlist = [
  { label: "Khan Academy", url: "https://www.khanacademy.org" },
  { label: "BBC Bitesize", url: "https://www.bbc.co.uk/bitesize" },
  { label: "Oak National Academy", url: "https://www.thenational.academy" },
  { label: "CK-12", url: "https://www.ck12.org" },
];

const suggestedLinksForTopic = (topic: string) => {
  const lower = topic.toLowerCase();
  if (lower.includes("cell") || lower.includes("respiration") || lower.includes("ecosystem")) {
    return [suggestedLinksAllowlist[0], suggestedLinksAllowlist[2]];
  }
  if (lower.includes("algebra") || lower.includes("ratio") || lower.includes("equation")) {
    return [suggestedLinksAllowlist[0], suggestedLinksAllowlist[3]];
  }
  if (lower.includes("reading") || lower.includes("writing") || lower.includes("paragraph")) {
    return [suggestedLinksAllowlist[1], suggestedLinksAllowlist[2]];
  }
  return [suggestedLinksAllowlist[0], suggestedLinksAllowlist[1]];
};

export default function DashboardClient({ schoolName }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("lesson");
  const [lessonInputs, setLessonInputs] = useState<LessonInputs>(defaultLessonInputs);
  const [resourceInputs, setResourceInputs] = useState<ResourceInputs>(defaultResourceInputs);
  const [feedbackInputs, setFeedbackInputs] = useState<FeedbackInputs>(defaultFeedbackInputs);
  const [tabOutputs, setTabOutputs] = useState<Record<TabKey, OutputState | null>>({
    lesson: null,
    resource: null,
    feedback: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPiiModal, setShowPiiModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"generate" | null>(null);

  const outputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedConfirm = sessionStorage.getItem(STORAGE_CONFIRM_KEY);
    if (storedConfirm !== "true") {
      setShowConfirmModal(false);
    }

    const storedLesson = sessionStorage.getItem(storageKeyForInputs("lesson"));
    const storedResource = sessionStorage.getItem(storageKeyForInputs("resource"));
    const storedFeedback = sessionStorage.getItem(storageKeyForInputs("feedback"));

    if (storedLesson) setLessonInputs(JSON.parse(storedLesson));
    if (storedResource) setResourceInputs(JSON.parse(storedResource));
    if (storedFeedback) setFeedbackInputs(JSON.parse(storedFeedback));

    const outputs: Record<TabKey, OutputState | null> = {
      lesson: null,
      resource: null,
      feedback: null,
    };
    (Object.keys(outputs) as TabKey[]).forEach((tab) => {
      const stored = sessionStorage.getItem(storageKeyForOutput(tab));
      if (stored) {
        outputs[tab] = JSON.parse(stored) as OutputState;
      }
    });
    setTabOutputs(outputs);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(storageKeyForInputs("lesson"), JSON.stringify(lessonInputs));
  }, [lessonInputs]);

  useEffect(() => {
    sessionStorage.setItem(storageKeyForInputs("resource"), JSON.stringify(resourceInputs));
  }, [resourceInputs]);

  useEffect(() => {
    sessionStorage.setItem(storageKeyForInputs("feedback"), JSON.stringify(feedbackInputs));
  }, [feedbackInputs]);

  useEffect(() => {
    (Object.keys(tabOutputs) as TabKey[]).forEach((tab) => {
      const output = tabOutputs[tab];
      if (output) {
        sessionStorage.setItem(storageKeyForOutput(tab), JSON.stringify(output));
      } else {
        sessionStorage.removeItem(storageKeyForOutput(tab));
      }
    });
  }, [tabOutputs]);

  useEffect(() => {
    if (tabOutputs[activeTab] && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [tabOutputs, activeTab]);

  useEffect(() => {
    if (activeTab === "resource") {
      const nextDefault =
        resourceCountConfig[resourceInputs.resourceType]?.defaultValue || "";
      if (resourceInputs.questionCount !== nextDefault) {
        setResourceInputs((prev) => ({ ...prev, questionCount: nextDefault }));
      }
    }
  }, [activeTab, resourceInputs.resourceType]);

  const currentOutput = tabOutputs[activeTab];
  const summary = summaryByTab[activeTab];

  const priorLearningRequired =
    activeTab === "lesson" ||
    (activeTab === "resource" && resourceInputs.resourceType === "Slides content pack");

  const countConfig = resourceCountConfig[resourceInputs.resourceType] ?? {
    min: 1,
    max: 20,
    defaultValue: "10",
    label: "Number of questions",
  };

  const questionCountValue = resourceInputs.questionCount.trim();
  const questionCountNumber = Number(questionCountValue);
  const questionCountValid =
    activeTab !== "resource" ||
    (questionCountValue.length > 0 &&
      Number.isFinite(questionCountNumber) &&
      Number.isInteger(questionCountNumber) &&
      questionCountNumber >= countConfig.min &&
      questionCountNumber <= countConfig.max);

  const questionCountError =
    activeTab === "resource" && !questionCountValid
      ? `Enter a whole number between ${countConfig.min} and ${countConfig.max}.`
      : "";

  const canGenerate = useMemo(() => {
    if (activeTab === "lesson") {
      return Boolean(lessonInputs.topic.trim()) && Boolean(lessonInputs.priorLearning.trim());
    }
    if (activeTab === "resource") {
      const priorOk = priorLearningRequired ? Boolean(resourceInputs.priorLearning.trim()) : true;
      return Boolean(resourceInputs.topic.trim()) && priorOk && questionCountValid;
    }
    return Boolean(feedbackInputs.questionText.trim()) && Boolean(feedbackInputs.studentText.trim());
  }, [activeTab, lessonInputs, resourceInputs, feedbackInputs, priorLearningRequired, questionCountValid]);

  const combinedInput = useMemo(() => {
    if (activeTab === "lesson") {
      return [lessonInputs.topic, lessonInputs.priorLearning, lessonInputs.notes].filter(Boolean).join(" ");
    }
    if (activeTab === "resource") {
      return [resourceInputs.topic, resourceInputs.priorLearning, resourceInputs.notes].filter(Boolean).join(" ");
    }
    return [feedbackInputs.questionText, feedbackInputs.studentText, feedbackInputs.rubric].filter(Boolean).join(" ");
  }, [activeTab, lessonInputs, resourceInputs, feedbackInputs]);

  const ensureConfirm = () => {
    const confirmed = sessionStorage.getItem(STORAGE_CONFIRM_KEY) === "true";
    if (!confirmed) {
      setShowConfirmModal(true);
      setPendingAction("generate");
      return false;
    }
    return true;
  };

  const handleConfirmModal = () => {
    sessionStorage.setItem(STORAGE_CONFIRM_KEY, "true");
    setShowConfirmModal(false);
    if (pendingAction === "generate") {
      handleGenerate();
    }
    setPendingAction(null);
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setPendingAction(null);
  };

  const handlePiiConfirm = async () => {
    setShowPiiModal(false);
    await handleGenerate();
  };

  const handlePiiCancel = () => {
    setShowPiiModal(false);
  };

  const handleGenerate = async () => {
    if (!ensureConfirm()) return;

    if (containsPii(combinedInput)) {
      setShowPiiModal(true);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const payload =
        activeTab === "lesson"
          ? {
              mode: "lesson",
              topic: lessonInputs.topic,
              grade: lessonInputs.grade,
              lesson_type: lessonInputs.lessonType,
              duration: lessonInputs.duration,
              class_ability: lessonInputs.classAbility,
              class_profile: lessonInputs.classProfile,
              curriculum_key: lessonInputs.curriculumKey,
              prior_learning: lessonInputs.priorLearning,
              notes: lessonInputs.notes,
            }
          : activeTab === "resource"
          ? {
              mode: "resource",
              topic: resourceInputs.topic,
              grade: resourceInputs.grade,
              class_ability: resourceInputs.classAbility,
              curriculum_key: resourceInputs.curriculumKey,
              resource_type: resourceInputs.resourceType,
              number_questions: questionCountNumber,
              prior_learning: resourceInputs.priorLearning,
              notes: resourceInputs.notes,
            }
          : {
              mode: "feedback",
              grade: feedbackInputs.grade,
              curriculum_key: feedbackInputs.curriculumKey,
              assessment_type: feedbackInputs.assessmentType,
              question_text: feedbackInputs.questionText,
              student_text: feedbackInputs.studentText,
              total_marks: feedbackInputs.totalMarks,
              rubric: feedbackInputs.rubric,
            };

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Unable to generate output.");
      }

      const data = await response.json();
      const output: OutputState = {
        title: data.title,
        sections: data.sections || [],
        slides: data.slides || undefined,
        citations: data.citations || [],
        formatWarning: data.formatWarning,
        curriculumWarning: data.curriculumWarning,
        message: data.message || null,
      };

      setTabOutputs((prev) => ({ ...prev, [activeTab]: output }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (activeTab === "lesson") {
      setLessonInputs(defaultLessonInputs);
    } else if (activeTab === "resource") {
      setResourceInputs(defaultResourceInputs);
    } else {
      setFeedbackInputs(defaultFeedbackInputs);
    }
    setTabOutputs((prev) => ({ ...prev, [activeTab]: null }));
    setError(null);
  };

  return (
    <AppShell schoolName={schoolName}>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Teacher planning workspace
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Do not paste student personal data. This is a demo with minimal internal logging.
              </p>
            </div>
            <Tabs active={activeTab} onChange={(tab) => setActiveTab(tab as TabKey)} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Reminder:</strong> Do not paste student personal data. If detected, you will be asked to confirm.
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900">{summary.title}</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                {summary.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>

            {activeTab === "lesson" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="topic"
                  label="Topic"
                  value={lessonInputs.topic}
                  onChange={(value) => setLessonInputs((prev) => ({ ...prev, topic: value }))}
                  placeholder="Cells and specialised cells"
                />
                <SelectField
                  id="grade"
                  label="Grade"
                  value={lessonInputs.grade}
                  options={gradeOptions}
                  onChange={(value) => setLessonInputs((prev) => ({ ...prev, grade: value }))}
                />
                <SelectField
                  id="lesson-type"
                  label="Lesson type"
                  value={lessonInputs.lessonType}
                  options={lessonTypeOptions}
                  onChange={(value) => setLessonInputs((prev) => ({ ...prev, lessonType: value }))}
                />
                <SelectField
                  id="duration"
                  label="Duration"
                  value={lessonInputs.duration}
                  options={durationOptions}
                  onChange={(value) => setLessonInputs((prev) => ({ ...prev, duration: value }))}
                />
                <SelectField
                  id="class-ability"
                  label="Class ability"
                  value={lessonInputs.classAbility}
                  options={abilityOptions}
                  onChange={(value) => setLessonInputs((prev) => ({ ...prev, classAbility: value }))}
                />
                <SelectField
                  id="curriculum"
                  label="Curriculum"
                  value={lessonInputs.curriculumKey}
                  options={curriculumOptions}
                  onChange={(value) => setLessonInputs((prev) => ({ ...prev, curriculumKey: value }))}
                />
                <TextField
                  id="prior-learning"
                  label="Prior learning / previous lesson (required)"
                  value={lessonInputs.priorLearning}
                  onChange={(value) => setLessonInputs((prev) => ({ ...prev, priorLearning: value }))}
                  placeholder="Key ideas from the previous lesson"
                />
              </div>
            ) : null}

            {activeTab === "resource" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="topic"
                  label="Topic"
                  value={resourceInputs.topic}
                  onChange={(value) => setResourceInputs((prev) => ({ ...prev, topic: value }))}
                  placeholder="Cells and specialised cells"
                />
                <SelectField
                  id="grade"
                  label="Grade"
                  value={resourceInputs.grade}
                  options={gradeOptions}
                  onChange={(value) => setResourceInputs((prev) => ({ ...prev, grade: value }))}
                />
                <SelectField
                  id="curriculum"
                  label="Curriculum"
                  value={resourceInputs.curriculumKey}
                  options={curriculumOptions}
                  onChange={(value) => setResourceInputs((prev) => ({ ...prev, curriculumKey: value }))}
                />
                <SelectField
                  id="resource-type"
                  label="Resource type"
                  value={resourceInputs.resourceType}
                  options={resourceTypeOptions}
                  onChange={(value) => setResourceInputs((prev) => ({ ...prev, resourceType: value }))}
                />
                <TextField
                  id="question-count"
                  label={countConfig.label}
                  value={resourceInputs.questionCount}
                  onChange={(value) => setResourceInputs((prev) => ({ ...prev, questionCount: value }))}
                  placeholder={countConfig.defaultValue}
                />
                <SelectField
                  id="class-ability"
                  label="Class ability"
                  value={resourceInputs.classAbility}
                  options={abilityOptions}
                  onChange={(value) => setResourceInputs((prev) => ({ ...prev, classAbility: value }))}
                />
                {resourceInputs.resourceType === "Slides content pack" ? (
                  <TextField
                    id="prior-learning"
                    label="Prior learning / previous lesson (required)"
                    value={resourceInputs.priorLearning}
                    onChange={(value) => setResourceInputs((prev) => ({ ...prev, priorLearning: value }))}
                    placeholder="Key ideas from the previous lesson"
                  />
                ) : null}
                {questionCountError ? (
                  <p className="text-xs text-red-600">{questionCountError}</p>
                ) : null}
              </div>
            ) : null}

            {activeTab === "feedback" ? (
              <div className="space-y-4">
                <SelectField
                  id="assessment-type"
                  label="Assessment type"
                  value={feedbackInputs.assessmentType}
                  options={assessmentTypeOptions}
                  onChange={(value) => setFeedbackInputs((prev) => ({ ...prev, assessmentType: value }))}
                />
                <SelectField
                  id="grade"
                  label="Grade"
                  value={feedbackInputs.grade}
                  options={gradeOptions}
                  onChange={(value) => setFeedbackInputs((prev) => ({ ...prev, grade: value }))}
                />
                <SelectField
                  id="curriculum"
                  label="Curriculum"
                  value={feedbackInputs.curriculumKey}
                  options={curriculumOptions}
                  onChange={(value) => setFeedbackInputs((prev) => ({ ...prev, curriculumKey: value }))}
                />
                <TextAreaField
                  id="question-text"
                  label="Question(s) set (required)"
                  value={feedbackInputs.questionText}
                  onChange={(value) => setFeedbackInputs((prev) => ({ ...prev, questionText: value }))}
                  placeholder="Paste the exact prompt or question(s) given to the student."
                  rows={4}
                />
                <TextAreaField
                  id="student-text"
                  label="Student response / work (required)"
                  value={feedbackInputs.studentText}
                  onChange={(value) => setFeedbackInputs((prev) => ({ ...prev, studentText: value }))}
                  placeholder="Paste anonymised student work here."
                  rows={6}
                />
              </div>
            ) : null}

            {activeTab === "lesson" ? (
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  Advanced options
                </summary>
                <div className="mt-3 space-y-3">
                  <TextField
                    id="class-profile"
                    label="Class profile"
                    value={lessonInputs.classProfile}
                    onChange={(value) => setLessonInputs((prev) => ({ ...prev, classProfile: value }))}
                  />
                  <TextAreaField
                    id="notes"
                    label="Notes / context"
                    value={lessonInputs.notes}
                    onChange={(value) => setLessonInputs((prev) => ({ ...prev, notes: value }))}
                    rows={3}
                  />
                </div>
              </details>
            ) : null}

            {activeTab === "resource" ? (
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  Advanced options
                </summary>
                <div className="mt-3 space-y-3">
                  <TextAreaField
                    id="notes"
                    label="Notes / context"
                    value={resourceInputs.notes}
                    onChange={(value) => setResourceInputs((prev) => ({ ...prev, notes: value }))}
                    rows={3}
                  />
                </div>
              </details>
            ) : null}

            {activeTab === "feedback" ? (
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  Advanced options
                </summary>
                <div className="mt-3 space-y-3">
                  <TextField
                    id="total-marks"
                    label="Total marks (optional)"
                    value={feedbackInputs.totalMarks}
                    onChange={(value) => setFeedbackInputs((prev) => ({ ...prev, totalMarks: value }))}
                  />
                  <TextAreaField
                    id="rubric"
                    label="Rubric / mark scheme (optional)"
                    value={feedbackInputs.rubric}
                    onChange={(value) => setFeedbackInputs((prev) => ({ ...prev, rubric: value }))}
                    rows={3}
                  />
                </div>
              </details>
            ) : null}

            {loading ? (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-500" />
                </div>
                <p className="text-xs text-slate-500">Generating your output…</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate || loading}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Generating…" : "Generate"}
              </button>
              {currentOutput && currentOutput.sections?.length ? (
                <DownloadButton
                  title={currentOutput.title}
                  topic={activeTab === "feedback" ? feedbackInputs.questionText : resourceInputs.topic}
                  mode={activeTab}
                  sections={currentOutput.sections}
                  slides={currentOutput.slides}
                  citations={currentOutput.citations}
                />
              ) : null}
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Reset
              </button>
            </div>
          </div>

          <div ref={outputRef}>
            {currentOutput ? (
              <OutputViewer
                title={currentOutput.title}
                sections={currentOutput.sections}
                slides={currentOutput.slides}
                citations={currentOutput.citations}
                error={error}
                formatWarning={currentOutput.formatWarning}
                curriculumWarning={currentOutput.curriculumWarning}
                message={currentOutput.message}
              />
            ) : (
              <OutputViewer
                title={previewByTab[activeTab].title}
                sections={previewByTab[activeTab].sections}
                citations={previewByTab[activeTab].citations}
                error={error}
              />
            )}

            {activeTab === "resource" && currentOutput ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-slate-800">
                  Suggested external resources
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-indigo-600">
                  {suggestedLinksForTopic(resourceInputs.topic).map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <PrivacyWarningModal
        open={showPiiModal}
        onCancel={handlePiiCancel}
        onConfirm={handlePiiConfirm}
      />
      <ConfirmModal
        open={showConfirmModal}
        title="Confirm personal data"
        description="Please confirm that no student personal data is included. This confirmation is required once per session."
        confirmLabel="I confirm"
        cancelLabel="Cancel"
        onConfirm={handleConfirmModal}
        onCancel={handleConfirmCancel}
      />
    </AppShell>
  );
}
