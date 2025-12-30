"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Tabs from "@/components/Tabs";
import AppShell from "@/components/AppShell";
import OutputViewer from "@/components/OutputViewer";
import DownloadButton from "@/components/DownloadButton";
import PrivacyWarningModal from "@/components/PrivacyWarningModal";
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
  message?: string | null;
}

interface DashboardClientProps {
  schoolName: string;
}

const yearOptions = [
  { value: "Year 8", label: "Year 8" },
  { value: "Year 7", label: "Year 7" },
  { value: "Year 9", label: "Year 9" },
];

const lessonTypeOptions = [
  { value: "New concept", label: "New concept" },
  { value: "Revision", label: "Revision" },
  { value: "Exam prep", label: "Exam prep" },
  { value: "Deepen understanding", label: "Deepen understanding" },
];

const durationOptions = [
  { value: "45", label: "45 minutes" },
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
  { value: "Exit ticket", label: "Exit ticket" },
  { value: "Quiz", label: "Quiz" },
];

const assessmentTypeOptions = [
  { value: "Short response", label: "Short response" },
  { value: "Extended response", label: "Extended response" },
  { value: "Multiple choice", label: "Multiple choice" },
];

const refineChips = [
  "More scaffolding",
  "More challenge",
  "Shorter",
  "More AFL",
  "More EAL support",
  "Add retrieval practice",
];

const previewByTab: Record<string, OutputState> = {
  lesson: {
    title: "Sample Lesson Plan: Cells and Specialised Cells",
    sections: [
      { heading: "Overview", content: "A structured PGCE-style lesson plan with sequence, AFL, and differentiation." },
      { heading: "Learning Objectives & Success Criteria", content: "Students will identify cell organelles and explain how structure supports function." },
    ],
    citations: [{ source: "Placeholder Curriculum v0.1", excerpt: "Students should be able to describe the structure and function of animal and plant cells." }],
  },
  resource: {
    title: "Sample Worksheet: Cells and Organisation",
    sections: [
      { heading: "Teacher Instructions", content: "Printable worksheet with short tasks and an answers section." },
      { heading: "Student Sheet (printable)", content: "Label the organelles and explain their roles." },
    ],
    citations: [{ source: "Placeholder Curriculum v0.1", excerpt: "Compare specialised cells and explain how structure supports function." }],
  },
  feedback: {
    title: "Sample Feedback: Cell Structure Explanation",
    sections: [
      { heading: "Student-Friendly Feedback", content: "Highlights strengths, misconceptions, and next steps." },
      { heading: "Teacher Notes", content: "Diagnostics and suggested reteach focus." },
    ],
    citations: [{ source: "Placeholder Curriculum v0.1", excerpt: "Describe the role of nucleus, cytoplasm, and cell membrane." }],
  },
};

const examplePrompts: Record<string, string[]> = {
  lesson: [
    "Plan a Year 8 lesson on respiration with a practical demo.",
    "Create a retrieval-heavy revision lesson on ecosystems.",
  ],
  resource: [
    "Generate a worksheet on plant vs animal cells.",
    "Create a short quiz on aerobic respiration.",
  ],
  feedback: [
    "Provide feedback on a paragraph explaining diffusion.",
    "Give teacher notes for misconceptions about ecosystems.",
  ],
};

const summaryByTab: Record<string, { title: string; bullets: string[] }> = {
  lesson: {
    title: "Lesson Planner",
    bullets: ["PGCE-standard plan", "AFL and differentiation", "Curriculum citations"],
  },
  resource: {
    title: "Resource Generator",
    bullets: ["Printable student sheet", "Teacher-only answers", "Differentiation guidance"],
  },
  feedback: {
    title: "Feedback",
    bullets: ["Student-friendly feedback", "Teacher diagnostics", "Removes personal data"],
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
  return lines.join("\n");
};

export default function DashboardClient({ schoolName }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState("lesson");
  const [topic, setTopic] = useState("Cells and specialised cells");
  const [notes, setNotes] = useState("");
  const [yearGroup, setYearGroup] = useState("Year 8");
  const [lessonType, setLessonType] = useState("New concept");
  const [duration, setDuration] = useState("60");
  const [classAbility, setClassAbility] = useState("Mixed");
  const [classProfile, setClassProfile] = useState("Mixed ability; 2 EAL; 1 SEND");
  const [resourceType, setResourceType] = useState("Worksheet");
  const [assessmentType, setAssessmentType] = useState("Short response");
  const [totalMarks, setTotalMarks] = useState("");
  const [rubric, setRubric] = useState("");
  const [teacherGuidance, setTeacherGuidance] = useState("");
  const [studentText, setStudentText] = useState("");
  const [confirmNoPii, setConfirmNoPii] = useState(false);
  const [output, setOutput] = useState<OutputState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineRequest, setRefineRequest] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement | null>(null);

  const combinedInput = useMemo(() => {
    return [topic, notes, studentText, classProfile, rubric, teacherGuidance, refineRequest]
      .filter(Boolean)
      .join(" ");
  }, [topic, notes, studentText, classProfile, rubric, teacherGuidance, refineRequest]);

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [output]);

  const canGenerate = useMemo(() => {
    if (!topic.trim()) return false;
    if (activeTab === "feedback") {
      return studentText.trim().length > 0 && confirmNoPii;
    }
    return true;
  }, [activeTab, topic, studentText, confirmNoPii]);

  const resetTab = () => {
    setNotes("");
    setTopic("Cells and specialised cells");
    setLessonType("New concept");
    setDuration("60");
    setClassAbility("Mixed");
    setClassProfile("Mixed ability; 2 EAL; 1 SEND");
    setResourceType("Worksheet");
    setAssessmentType("Short response");
    setTotalMarks("");
    setRubric("");
    setTeacherGuidance("");
    setStudentText("");
    setConfirmNoPii(false);
    setOutput(null);
    setError(null);
    setRefineOpen(false);
    setRefineRequest("");
  };

  const submitRequest = async (refine = false) => {
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
          topic,
          notes,
          year_group: yearGroup,
          lesson_type: lessonType,
          duration,
          class_ability: classAbility,
          class_profile: classProfile,
          resource_type: resourceType,
          assessment_type: assessmentType,
          total_marks: totalMarks,
          rubric,
          teacher_guidance: teacherGuidance,
          student_text: activeTab === "feedback" ? studentText : undefined,
          refine_request: refine ? refineRequest : "",
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate output.");
      }

      const data = await response.json();
      setOutput({
        title: data.title,
        sections: data.sections || [],
        citations: data.citations || [],
        formatWarning: data.formatWarning,
        message: data.message || null,
      });
      setRefineOpen(false);
      setRefineRequest("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (containsPii(combinedInput)) {
      setShowModal(true);
      setPendingSubmit(true);
      return;
    }

    await submitRequest();
  };

  const handleRefine = async () => {
    if (!refineRequest.trim()) {
      setError("Please describe what should change in the output.");
      return;
    }
    await submitRequest(true);
  };

  const handleModalConfirm = async () => {
    setShowModal(false);
    if (pendingSubmit) {
      setPendingSubmit(false);
      await submitRequest();
    }
  };

  const handleModalCancel = () => {
    setShowModal(false);
    setPendingSubmit(false);
  };

  const handleCopy = async () => {
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

  const summary = summaryByTab[activeTab];

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
            <Tabs active={activeTab} onChange={(tab) => {
              setActiveTab(tab);
              setOutput(null);
              setError(null);
              setRefineOpen(false);
              setRefineRequest("");
            }} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Warning:</strong> Do not paste student personal data. If detected, you will be asked to confirm.
            </div>

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

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="topic"
                label="Topic"
                value={topic}
                onChange={setTopic}
                placeholder="Cells and specialised cells"
              />
              <SelectField
                id="year-group"
                label="Year group"
                value={yearGroup}
                options={yearOptions}
                onChange={setYearGroup}
              />
              <SelectField
                id="lesson-type"
                label="Lesson type"
                value={lessonType}
                options={lessonTypeOptions}
                onChange={setLessonType}
              />
              <SelectField
                id="duration"
                label="Duration"
                value={duration}
                options={durationOptions}
                onChange={setDuration}
              />
              <SelectField
                id="class-ability"
                label="Class ability"
                value={classAbility}
                options={abilityOptions}
                onChange={setClassAbility}
              />
              <TextField
                id="class-profile"
                label="Class profile"
                value={classProfile}
                onChange={setClassProfile}
                placeholder="Mixed ability; 2 EAL; 1 SEND"
              />
            </div>

            {activeTab === "resource" ? (
              <SelectField
                id="resource-type"
                label="Resource type"
                value={resourceType}
                options={resourceTypeOptions}
                onChange={setResourceType}
              />
            ) : null}

            {activeTab === "feedback" ? (
              <div className="space-y-4">
                <SelectField
                  id="assessment-type"
                  label="Assessment type"
                  value={assessmentType}
                  options={assessmentTypeOptions}
                  onChange={setAssessmentType}
                />
                <TextField
                  id="total-marks"
                  label="Total marks (optional)"
                  value={totalMarks}
                  onChange={setTotalMarks}
                  placeholder="e.g. /20"
                />
                <TextAreaField
                  id="rubric"
                  label="Rubric / criteria (optional)"
                  value={rubric}
                  onChange={setRubric}
                  placeholder="Paste marking criteria."
                  rows={4}
                />
                <TextAreaField
                  id="teacher-guidance"
                  label="Teacher guidance (optional)"
                  value={teacherGuidance}
                  onChange={setTeacherGuidance}
                  placeholder="Anything to emphasize in feedback."
                  rows={3}
                />
                <TextAreaField
                  id="student-text"
                  label="Student response / work (required)"
                  value={studentText}
                  onChange={setStudentText}
                  placeholder="Paste anonymised student work here."
                  rows={6}
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={confirmNoPii}
                    onChange={(event) => setConfirmNoPii(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  I confirm this contains no student personal data.
                </label>
              </div>
            ) : null}

            <TextAreaField
              id="notes"
              label="Notes / context (optional)"
              value={notes}
              onChange={setNotes}
              placeholder="Any additional context or constraints."
              rows={4}
            />

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
              <button
                type="button"
                onClick={resetTab}
                disabled={loading}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Reset
              </button>
              {output && output.sections?.length ? (
                <DownloadButton
                  title={output.title}
                  topic={topic}
                  mode={activeTab}
                  sections={output.sections}
                  citations={output.citations}
                />
              ) : null}
              {output ? (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Copy to clipboard
                </button>
              ) : null}
              {copyStatus ? <span className="text-xs text-slate-500">{copyStatus}</span> : null}
            </div>

            {output ? (
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
                          onClick={() => setRefineRequest((prev) => (prev ? `${prev}; ${chip}` : chip))}
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
            {output ? (
              <OutputViewer
                title={output.title}
                sections={output.sections}
                citations={output.citations}
                error={error}
                formatWarning={output.formatWarning}
                message={output.message}
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
        open={showModal}
        onCancel={handleModalCancel}
        onConfirm={handleModalConfirm}
      />
    </AppShell>
  );
}
