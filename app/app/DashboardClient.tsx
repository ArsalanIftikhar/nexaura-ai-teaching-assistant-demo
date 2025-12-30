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

interface Citation {
  source: string;
  excerpt: string;
}

interface OutputState {
  title: string;
  sections: Section[];
  citations: Citation[];
  formatWarning?: boolean;
  curriculumWarning?: boolean;
  message?: string | null;
}

interface SlideOutline {
  title: string;
  slides: { title: string; bullets: string[] }[];
}

interface DashboardClientProps {
  schoolName: string;
}

type TabKey = "lesson" | "resource" | "feedback" | "slides";

interface InputState {
  topic: string;
  grade: string;
  lessonType: string;
  duration: string;
  classAbility: string;
  classProfile: string;
  curriculumKey: string;
  notes: string;
  resourceType: string;
  questionCount: number;
  assessmentType: string;
  totalMarks: string;
  rubric: string;
  teacherGuidance: string;
  studentText: string;
  consistencyLock: boolean;
}

const STORAGE_CONFIRM_KEY = "nexaura_confirm_no_pii";
const STORAGE_CONTEXT_KEY = "nexaura_topic_context";

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
  { value: "Revision", label: "Revision" },
  { value: "Exam prep", label: "Exam prep" },
  { value: "Deepen understanding", label: "Deepen understanding" },
];

const durationOptions = [
  { value: "60", label: "60 minutes" },
  { value: "90", label: "90 minutes" },
  { value: "45", label: "45 minutes" },
];

const abilityOptions = [
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
  { value: "Mixed", label: "Mixed" },
];

const resourceTypeOptions = [
  { value: "Worksheet", label: "Worksheet" },
  { value: "Exit ticket", label: "Exit ticket" },
  { value: "Quiz", label: "Quiz" },
  { value: "MCQ quiz", label: "MCQ quiz" },
  { value: "Mini whiteboard questions", label: "Mini whiteboard questions" },
  { value: "Starter questions", label: "Starter questions" },
];

const assessmentTypeOptions = [
  { value: "MCQ", label: "MCQ" },
  { value: "Short answer", label: "Short answer" },
  { value: "Extended response", label: "Extended response" },
  { value: "Exam question", label: "Exam question" },
  { value: "Other", label: "Other" },
];

const refineChips = [
  "More scaffolding",
  "More challenge",
  "Shorter",
  "More Assessment for Learning (checks for understanding)",
  "More EAL support",
  "Add retrieval practice",
];

const previewByTab: Record<TabKey, OutputState> = {
  lesson: {
    title: "Sample Lesson Plan: Cells and Specialised Cells",
    sections: [
      {
        heading: "Overview",
        content:
          "Grade 8 science lesson focused on cell structure and specialised cells. UK PGCE-style lesson structure adapted for Pakistan schools.",
      },
      {
        heading: "Prior Knowledge & Diagnostic",
        content: "Quick recall of plant vs animal cells; prompt questions to surface misconceptions.",
      },
      {
        heading: "Learning Objectives & Success Criteria",
        content:
          "Objectives: Identify organelles and explain their functions (3–5). Success criteria: Label diagrams and justify structure-function links.",
      },
      {
        heading: "Key Vocabulary",
        content: "nucleus, cytoplasm, cell membrane, mitochondria, chloroplast, vacuole",
      },
      {
        heading: "Likely Misconceptions & Fixes",
        content: "Clarify that plants respire; explain difference between breathing and respiration.",
      },
      {
        heading: "Lesson Sequence (Starter / Main input / Guided practice / Independent practice / Wrap-up)",
        content:
          "Starter 10, Main input 15, Guided practice 15, Independent practice 15, Wrap-up 5 (for a 60-minute lesson).",
      },
      {
        heading: "Assessment for Learning (checks for understanding)",
        content: "Quick hinge questions and mini whiteboard checks.",
      },
      {
        heading: "Differentiation (support + stretch)",
        content: "Support with sentence starters; stretch by comparing specialised cells.",
      },
      {
        heading: "Resources Needed",
        content: "Cell diagrams, labels, projector slides.",
      },
      {
        heading: "Exit Ticket",
        content: "One question: explain why mitochondria are important for energy.",
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
    title: "Sample Worksheet: Cell Structure",
    sections: [
      {
        heading: "Teacher Instructions",
        content: "Printable worksheet with 10 questions aligned to Grade 8 outcomes.",
      },
      {
        heading: "Student Sheet (printable)",
        content: "Label organelles and explain their functions in full sentences.",
      },
      {
        heading: "Answers / Marking Guidance (teacher-only)",
        content: "Provide concise model answers and mark allocation.",
      },
      {
        heading: "Differentiation (support + extend)",
        content: "Support with word bank; extend with comparison of specialised cells.",
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
  slides: {
    title: "Sample Slides: Ecosystems",
    sections: [
      {
        heading: "Slide Outline",
        content:
          "- Title\n- Learning objectives\n- Key vocabulary\n- Starter\n- Main input\n- Guided practice\n- Independent practice\n- Wrap-up\n- Checks for understanding\n- Misconceptions\n- Practice questions\n- Summary + exit question",
      },
    ],
    citations: [
      {
        source: "grade8_science.md",
        excerpt:
          "Construct food chains and interpret effects of population changes.",
      },
    ],
  },
};

const examplePrompts: Record<TabKey, string[]> = {
  lesson: [
    "Plan a Grade 8 lesson on respiration with a quick demonstration.",
    "Create a revision lesson on ecosystems with structured checks for understanding.",
  ],
  resource: [
    "Generate a worksheet on plant vs animal cells with 10 questions.",
    "Create an MCQ quiz on aerobic respiration with 10 items.",
  ],
  feedback: [
    "Provide feedback on a paragraph explaining diffusion.",
    "Give teacher notes for misconceptions about food webs.",
  ],
  slides: [
    "Create slides for a Grade 8 lesson on ecosystems.",
    "Build a slide deck for a revision lesson on cell structure.",
  ],
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
    bullets: ["Printable student sheet", "Teacher-only answers", "Differentiation guidance"],
  },
  feedback: {
    title: "Feedback",
    bullets: ["Student-friendly feedback", "Teacher diagnostics", "No personal data"],
  },
  slides: {
    title: "Slides (PowerPoint)",
    bullets: ["Lesson sequence slides", "Key vocabulary + checks", "Download PPTX"],
  },
};

const buildPlainText = (output: OutputState) => {
  const lines = [output.title, ""];
  output.sections.forEach((section) => {
    lines.push(section.heading);
    lines.push(section.content);
    lines.push("");
  });
  if (output.citations.length > 0) {
    lines.push("Curriculum citations:");
    output.citations.forEach((citation) => {
      lines.push(`- ${citation.source}: ${citation.excerpt}`);
    });
  }
  lines.push("© NexAura. For school use only.");
  return lines.join("\n");
};

const storageKeyForInputs = (tab: TabKey) => `nexaura_inputs_${tab}`;
const storageKeyForOutput = (tab: TabKey) => `nexaura_output_${tab}`;

const defaultInputsByTab: Record<TabKey, InputState> = {
  lesson: {
    topic: "Cells and specialised cells",
    grade: "Grade 8",
    lessonType: "New concept",
    duration: "60",
    classAbility: "Mixed",
    classProfile: "2 EAL learners; 1 learner needing additional support; varying confidence",
    curriculumKey: "national_pk",
    notes: "",
    resourceType: "Worksheet",
    questionCount: 10,
    assessmentType: "Short answer",
    totalMarks: "",
    rubric: "",
    teacherGuidance: "",
    studentText: "",
    consistencyLock: false,
  },
  resource: {
    topic: "Cells and specialised cells",
    grade: "Grade 8",
    lessonType: "New concept",
    duration: "60",
    classAbility: "Mixed",
    classProfile: "2 EAL learners; 1 learner needing additional support; varying confidence",
    curriculumKey: "national_pk",
    notes: "",
    resourceType: "Worksheet",
    questionCount: 10,
    assessmentType: "Short answer",
    totalMarks: "",
    rubric: "",
    teacherGuidance: "",
    studentText: "",
    consistencyLock: false,
  },
  feedback: {
    topic: "Student work feedback",
    grade: "Grade 8",
    lessonType: "New concept",
    duration: "60",
    classAbility: "Mixed",
    classProfile: "",
    curriculumKey: "national_pk",
    notes: "",
    resourceType: "Worksheet",
    questionCount: 10,
    assessmentType: "Short answer",
    totalMarks: "",
    rubric: "",
    teacherGuidance: "",
    studentText: "",
    consistencyLock: false,
  },
  slides: {
    topic: "Cells and specialised cells",
    grade: "Grade 8",
    lessonType: "New concept",
    duration: "60",
    classAbility: "Mixed",
    classProfile: "2 EAL learners; 1 learner needing additional support; varying confidence",
    curriculumKey: "national_pk",
    notes: "",
    resourceType: "Worksheet",
    questionCount: 10,
    assessmentType: "Short answer",
    totalMarks: "",
    rubric: "",
    teacherGuidance: "",
    studentText: "",
    consistencyLock: false,
  },
};

const extractLessonContext = (output: OutputState) => {
  const find = (needle: string) =>
    output.sections.find((section) =>
      section.heading.toLowerCase().includes(needle.toLowerCase())
    )?.content;

  const objectives = find("Learning Objectives") || "";
  const vocabulary = find("Key Vocabulary") || "";
  const misconceptions = find("Misconceptions") || "";
  const checks = find("Assessment for Learning") || "";
  const sequence = find("Lesson Sequence") || "";

  return [
    `Learning objectives & success criteria: ${objectives}`,
    `Key vocabulary: ${vocabulary}`,
    `Misconceptions & fixes: ${misconceptions}`,
    `Lesson sequence: ${sequence}`,
    `Checks for understanding: ${checks}`,
  ]
    .filter((line) => line.trim().length > 0)
    .join("\n");
};

export default function DashboardClient({ schoolName }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("lesson");
  const [confirmNoPii, setConfirmNoPii] = useState(false);
  const [tabOutputs, setTabOutputs] = useState<Record<TabKey, OutputState | null>>({
    lesson: null,
    resource: null,
    feedback: null,
    slides: null,
  });
  const [slideOutline, setSlideOutline] = useState<SlideOutline | null>(null);
  const [topicContext, setTopicContext] = useState<string | null>(null);

  const [inputs, setInputs] = useState<InputState>(defaultInputsByTab["lesson"]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPiiModal, setShowPiiModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<"generate" | "slides" | "export" | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineRequest, setRefineRequest] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedConfirm = sessionStorage.getItem(STORAGE_CONFIRM_KEY);
    if (storedConfirm === "true") {
      setConfirmNoPii(true);
    }
    const storedContext = sessionStorage.getItem(STORAGE_CONTEXT_KEY);
    if (storedContext) {
      setTopicContext(storedContext);
    }

    const outputs: Record<TabKey, OutputState | null> = {
      lesson: null,
      resource: null,
      feedback: null,
      slides: null,
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
    const storedInputs = sessionStorage.getItem(storageKeyForInputs(activeTab));
    if (storedInputs) {
      setInputs({
        ...defaultInputsByTab[activeTab],
        ...JSON.parse(storedInputs),
      });
    } else {
      const defaults = { ...defaultInputsByTab[activeTab] };
      if ((activeTab === "resource" || activeTab === "slides") && topicContext) {
        defaults.consistencyLock = true;
      }
      setInputs(defaults);
    }
    if (activeTab !== "lesson") {
      setRefineOpen(false);
      setRefineRequest("");
    }
  }, [activeTab, topicContext]);

  useEffect(() => {
    sessionStorage.setItem(storageKeyForInputs(activeTab), JSON.stringify(inputs));
  }, [inputs, activeTab]);

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
    if (activeTab !== "resource") return;
    const defaults: Record<string, number> = {
      Worksheet: 10,
      "Exit ticket": 5,
      Quiz: 10,
      "MCQ quiz": 10,
      "Mini whiteboard questions": 6,
      "Starter questions": 5,
    };
    const nextCount = defaults[inputs.resourceType] || 10;
    if (inputs.questionCount !== nextCount) {
      setInputs((prev) => ({ ...prev, questionCount: nextCount }));
    }
  }, [activeTab, inputs.resourceType]);

  const summary = summaryByTab[activeTab];

  const combinedInput = useMemo(() => {
    return [inputs.topic, inputs.notes, inputs.studentText, refineRequest]
      .filter(Boolean)
      .join(" ");
  }, [inputs, refineRequest]);

  const canGenerate = useMemo(() => {
    if (activeTab === "feedback") {
      return Boolean(inputs.studentText?.trim());
    }
    if (activeTab === "slides") {
      return Boolean(inputs.topic?.trim());
    }
    return Boolean(inputs.topic?.trim());
  }, [activeTab, inputs]);

  const ensureConfirm = (next: "generate" | "slides" | "export") => {
    if (!confirmNoPii) {
      setShowConfirmModal(true);
      setPendingSubmit(next);
      return false;
    }
    return true;
  };

  const handleConfirmModal = () => {
    setConfirmNoPii(true);
    sessionStorage.setItem(STORAGE_CONFIRM_KEY, "true");
    setShowConfirmModal(false);
    if (pendingSubmit === "generate") {
      handleGenerate();
    } else if (pendingSubmit === "slides") {
      handleSlides();
    } else if (pendingSubmit === "export") {
      handleExportPack();
    }
    setPendingSubmit(null);
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setPendingSubmit(null);
  };

  const handlePiiConfirm = async () => {
    setShowPiiModal(false);
    if (pendingSubmit === "generate") {
      await handleGenerate();
    } else if (pendingSubmit === "slides") {
      await handleSlides();
    } else if (pendingSubmit === "export") {
      await handleExportPack();
    }
    setPendingSubmit(null);
  };

  const handlePiiCancel = () => {
    setShowPiiModal(false);
    setPendingSubmit(null);
  };

  const basePayload = () => ({
    topic: inputs.topic ?? "",
    grade: inputs.grade ?? "",
    lesson_type: inputs.lessonType ?? "",
    duration: inputs.duration ?? "",
    class_ability: inputs.classAbility ?? "",
    class_profile: inputs.classProfile ?? "",
    curriculum_key: inputs.curriculumKey ?? "national_pk",
    notes: inputs.notes ?? "",
    resource_type: inputs.resourceType ?? "",
    number_questions: inputs.questionCount,
    assessment_type: inputs.assessmentType ?? "",
    total_marks: inputs.totalMarks ?? "",
    rubric: inputs.rubric ?? "",
    teacher_guidance: inputs.teacherGuidance ?? "",
    student_text: inputs.studentText ?? "",
    consistency_lock: inputs.consistencyLock ?? false,
    topic_session_context: inputs.consistencyLock ? topicContext || "" : "",
  });

  const handleGenerate = async () => {
    if (!ensureConfirm("generate")) return;

    if (containsPii(combinedInput)) {
      setShowPiiModal(true);
      setPendingSubmit("generate");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: activeTab,
          ...basePayload(),
          refine_request: refineRequest,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate output.");
      }

      const data = await response.json();
      const output: OutputState = {
        title: data.title,
        sections: data.sections || [],
        citations: data.citations || [],
        formatWarning: data.formatWarning,
        curriculumWarning: data.curriculumWarning,
        message: data.message || null,
      };

      setTabOutputs((prev) => ({ ...prev, [activeTab]: output }));

      if (activeTab === "lesson") {
        const context = extractLessonContext(output);
        if (context) {
          sessionStorage.setItem(STORAGE_CONTEXT_KEY, context);
          setTopicContext(context);
        }
      }

      setRefineOpen(false);
      setRefineRequest("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSlides = async () => {
    if (!ensureConfirm("slides")) return;

    if (containsPii(combinedInput)) {
      setShowPiiModal(true);
      setPendingSubmit("slides");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/slides?format=json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...basePayload(),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate slides.");
      }

      const data = await response.json();
      setSlideOutline(data.outline || null);
      setTabOutputs((prev) => ({
        ...prev,
        slides: {
          title: data.outline?.title || "Slides ready",
          sections: [
            {
              heading: "Slide Outline",
              content:
                data.outline?.slides
                  ?.map((slide: { title: string }) => `- ${slide.title}`)
                  .join("\n") || "Slides generated. Use the download button.",
            },
          ],
          citations: data.citations || [],
          curriculumWarning: data.curriculumWarning,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSlides = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/slides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...basePayload(),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to download slides.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename=([^;]+)/i);
      link.download = match ? match[1].replace(/"/g, "") : "NexAura_Slides.pptx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!refineRequest.trim()) {
      setError("Please describe what should change in the output.");
      return;
    }
    await handleGenerate();
  };

  const handleCopy = async () => {
    const output = tabOutputs[activeTab];
    if (!output) return;
    try {
      await navigator.clipboard.writeText(buildPlainText(output));
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const handleReset = () => {
    setInputs(defaultInputsByTab[activeTab]);
    setTabOutputs((prev) => ({ ...prev, [activeTab]: null }));
    if (activeTab === "lesson") {
      sessionStorage.removeItem(STORAGE_CONTEXT_KEY);
      setTopicContext(null);
    }
    setError(null);
    setRefineOpen(false);
    setRefineRequest("");
  };

  const handleExportPack = async () => {
    if (!ensureConfirm("export")) return;

    if (containsPii(combinedInput)) {
      setShowPiiModal(true);
      setPendingSubmit("export");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/export-pack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: inputs.topic,
          grade: inputs.grade,
          curriculum_key: inputs.curriculumKey,
          lesson: tabOutputs.lesson,
          resource: tabOutputs.resource,
          slides: slideOutline,
          basePayload: basePayload(),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to export pack.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename=([^;]+)/i);
      link.download = match ? match[1].replace(/"/g, "") : "NexAura_Pack.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentOutput = tabOutputs[activeTab];
  const consistencyAvailable = Boolean(topicContext);

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

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={confirmNoPii}
                onChange={(event) => {
                  setConfirmNoPii(event.target.checked);
                  if (event.target.checked) {
                    sessionStorage.setItem(STORAGE_CONFIRM_KEY, "true");
                  } else {
                    sessionStorage.removeItem(STORAGE_CONFIRM_KEY);
                  }
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              I confirm no student personal data is included.
            </label>

            <div>
              <h3 className="text-base font-semibold text-slate-900">{summary.title}</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                {summary.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <details className="mt-3 text-sm text-slate-600">
                <summary className="cursor-pointer font-semibold text-indigo-600">Example prompts</summary>
                <ul className="mt-2 list-disc pl-5">
                  {examplePrompts[activeTab].map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              </details>
            </div>

            {activeTab === "lesson" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="topic"
                  label="Topic"
                  value={inputs.topic}
                  onChange={(value) => setInputs((prev) => ({ ...prev, topic: value }))}
                  placeholder="Cells and specialised cells"
                />
                <SelectField
                  id="grade"
                  label="Grade"
                  value={inputs.grade}
                  options={gradeOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, grade: value }))}
                />
                <SelectField
                  id="lesson-type"
                  label="Lesson type"
                  value={inputs.lessonType}
                  options={lessonTypeOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, lessonType: value }))}
                />
                <SelectField
                  id="duration"
                  label="Duration"
                  value={inputs.duration}
                  options={durationOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, duration: value }))}
                />
                <SelectField
                  id="class-ability"
                  label="Class ability"
                  value={inputs.classAbility}
                  options={abilityOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, classAbility: value }))}
                />
                <TextField
                  id="class-profile"
                  label="Class profile"
                  value={inputs.classProfile}
                  onChange={(value) => setInputs((prev) => ({ ...prev, classProfile: value }))}
                  placeholder="2 EAL learners; 1 learner needing additional support; varying confidence"
                />
                <SelectField
                  id="curriculum"
                  label="Curriculum"
                  value={inputs.curriculumKey}
                  options={curriculumOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, curriculumKey: value }))}
                />
              </div>
            ) : null}

            {activeTab === "resource" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="topic"
                  label="Topic"
                  value={inputs.topic}
                  onChange={(value) => setInputs((prev) => ({ ...prev, topic: value }))}
                  placeholder="Cells and specialised cells"
                />
                <SelectField
                  id="grade"
                  label="Grade"
                  value={inputs.grade}
                  options={gradeOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, grade: value }))}
                />
                <SelectField
                  id="curriculum"
                  label="Curriculum"
                  value={inputs.curriculumKey}
                  options={curriculumOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, curriculumKey: value }))}
                />
                <SelectField
                  id="resource-type"
                  label="Resource type"
                  value={inputs.resourceType}
                  options={resourceTypeOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, resourceType: value }))}
                />
                <TextField
                  id="question-count"
                  label="Number of questions"
                  value={String(inputs.questionCount ?? "")}
                  onChange={(value) =>
                    setInputs((prev) => ({ ...prev, questionCount: Number(value) || 1 }))
                  }
                  placeholder="10"
                />
                <SelectField
                  id="class-ability"
                  label="Class ability"
                  value={inputs.classAbility}
                  options={abilityOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, classAbility: value }))}
                />
              </div>
            ) : null}

            {activeTab === "slides" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="topic"
                  label="Topic"
                  value={inputs.topic}
                  onChange={(value) => setInputs((prev) => ({ ...prev, topic: value }))}
                  placeholder="Cells and specialised cells"
                />
                <SelectField
                  id="grade"
                  label="Grade"
                  value={inputs.grade}
                  options={gradeOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, grade: value }))}
                />
                <SelectField
                  id="curriculum"
                  label="Curriculum"
                  value={inputs.curriculumKey}
                  options={curriculumOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, curriculumKey: value }))}
                />
                <SelectField
                  id="duration"
                  label="Duration"
                  value={inputs.duration}
                  options={durationOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, duration: value }))}
                />
                <SelectField
                  id="lesson-type"
                  label="Lesson type"
                  value={inputs.lessonType}
                  options={lessonTypeOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, lessonType: value }))}
                />
                <SelectField
                  id="class-ability"
                  label="Class ability"
                  value={inputs.classAbility}
                  options={abilityOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, classAbility: value }))}
                />
              </div>
            ) : null}

            {activeTab === "feedback" ? (
              <div className="space-y-4">
                <SelectField
                  id="assessment-type"
                  label="Assessment type"
                  value={inputs.assessmentType}
                  options={assessmentTypeOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, assessmentType: value }))}
                />
                <SelectField
                  id="grade"
                  label="Grade (optional)"
                  value={inputs.grade}
                  options={gradeOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, grade: value }))}
                />
                <SelectField
                  id="curriculum"
                  label="Curriculum (optional)"
                  value={inputs.curriculumKey}
                  options={curriculumOptions}
                  onChange={(value) => setInputs((prev) => ({ ...prev, curriculumKey: value }))}
                />
                <TextField
                  id="total-marks"
                  label="Total marks (optional)"
                  value={inputs.totalMarks}
                  onChange={(value) => setInputs((prev) => ({ ...prev, totalMarks: value }))}
                  placeholder="e.g. 20"
                />
                <TextAreaField
                  id="rubric"
                  label="Rubric / mark scheme (optional)"
                  value={inputs.rubric}
                  onChange={(value) => setInputs((prev) => ({ ...prev, rubric: value }))}
                  placeholder="Paste marking criteria."
                  rows={4}
                />
                <TextAreaField
                  id="teacher-guidance"
                  label="Teacher guidance (optional)"
                  value={inputs.teacherGuidance}
                  onChange={(value) => setInputs((prev) => ({ ...prev, teacherGuidance: value }))}
                  placeholder="Anything to emphasize in feedback."
                  rows={3}
                />
                <TextAreaField
                  id="student-text"
                  label="Student work text (required)"
                  value={inputs.studentText}
                  onChange={(value) => setInputs((prev) => ({ ...prev, studentText: value }))}
                  placeholder="Paste anonymised student work here."
                  rows={6}
                />
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-800">
                    Feedback (Upload) — Coming soon
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    File uploads will be available in a future update. Use the text box above for now.
                  </p>
                  <input
                    type="file"
                    disabled
                    className="mt-3 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-500"
                  />
                </div>
              </div>
            ) : null}

            {(activeTab === "lesson" || activeTab === "resource" || activeTab === "slides") ? (
              <TextAreaField
                id="notes"
                label="Notes / context (optional)"
                value={inputs.notes}
                onChange={(value) => setInputs((prev) => ({ ...prev, notes: value }))}
                placeholder="Any additional context or constraints."
                rows={4}
              />
            ) : null}

            {(activeTab === "lesson" || activeTab === "resource" || activeTab === "slides") ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={inputs.consistencyLock && consistencyAvailable}
                    disabled={!consistencyAvailable}
                    onChange={(event) =>
                      setInputs((prev) => ({ ...prev, consistencyLock: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Lock consistency with the latest lesson plan context
                </label>
                {!consistencyAvailable ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Generate a lesson plan first to lock objectives, vocabulary, and misconceptions.
                  </p>
                ) : null}
              </div>
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
              {activeTab === "slides" ? (
                <button
                  type="button"
                  onClick={handleSlides}
                  disabled={!canGenerate || loading}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Generating…" : "Generate slides"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate || loading}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Generating…" : "Generate"}
                </button>
              )}
              {currentOutput && currentOutput.sections?.length && activeTab !== "slides" ? (
                <DownloadButton
                  title={currentOutput.title}
                  topic={inputs.topic}
                  mode={activeTab}
                  sections={currentOutput.sections}
                  citations={currentOutput.citations}
                />
              ) : null}
              {activeTab === "slides" && currentOutput ? (
                <button
                  type="button"
                  onClick={handleDownloadSlides}
                  disabled={loading}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Download PPTX
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleCopy}
                disabled={!currentOutput}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Copy to clipboard
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleExportPack}
                disabled={loading || !inputs.topic}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
              >
                Export pack
              </button>
              {copyStatus ? <span className="text-xs text-slate-500">{copyStatus}</span> : null}
            </div>

            {activeTab === "lesson" && currentOutput ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={() => setRefineOpen((prev) => !prev)}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {refineOpen ? "Hide refine options" : "Refine output"}
                </button>
                {refineOpen ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {refineChips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() =>
                            setRefineRequest((prev) => (prev ? `${prev}; ${chip}` : chip))
                          }
                          className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <TextAreaField
                      id="refine-request"
                      label="What should change? (required)"
                      value={refineRequest}
                      onChange={setRefineRequest}
                      placeholder="Be specific about what should change."
                      rows={3}
                    />
                    <button
                      type="button"
                      onClick={handleRefine}
                      disabled={loading || !refineRequest.trim()}
                      className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      Apply refinement
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div ref={outputRef}>
            {currentOutput ? (
              <OutputViewer
                title={currentOutput.title}
                sections={currentOutput.sections}
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
