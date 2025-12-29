"use client";

import { useMemo, useState } from "react";
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

export default function DashboardClient({ schoolName }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState("lesson");
  const [topic, setTopic] = useState("Cells and specialised cells");
  const [notes, setNotes] = useState("");
  const [yearGroup, setYearGroup] = useState("Year 8");
  const [lessonType, setLessonType] = useState("New concept");
  const [duration, setDuration] = useState("60");
  const [classAbility, setClassAbility] = useState("Mixed");
  const [classProfile, setClassProfile] = useState("Mixed ability; 2 EAL; 1 SEND");
  const [studentText, setStudentText] = useState("");
  const [output, setOutput] = useState<{ title: string; sections: Section[]; citations: { source: string; excerpt: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const combinedInput = useMemo(() => {
    return [topic, notes, studentText, classProfile].filter(Boolean).join(" ");
  }, [topic, notes, studentText, classProfile]);

  const canGenerate = topic.trim().length > 1 && !loading;

  const submitRequest = async () => {
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
          student_text: activeTab === "feedback" ? studentText : undefined,
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
      });
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
            <Tabs active={activeTab} onChange={setActiveTab} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Warning:</strong> Do not paste student personal data. If detected, you will be asked to confirm.
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

            <TextAreaField
              id="notes"
              label="Notes / context (optional)"
              value={notes}
              onChange={setNotes}
              placeholder="Any additional context or constraints."
              rows={4}
            />

            {activeTab === "feedback" ? (
              <TextAreaField
                id="student-text"
                label="Student response / work"
                value={studentText}
                onChange={setStudentText}
                placeholder="Paste anonymised student work here."
                rows={6}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Generating…" : "Generate"}
              </button>
              {output && output.sections?.length ? (
                <DownloadButton
                  title={output.title}
                  topic={topic}
                  mode={activeTab}
                  sections={output.sections}
                />
              ) : null}
            </div>
          </div>

          <OutputViewer
            title={output?.title}
            sections={output?.sections}
            citations={output?.citations}
            error={error}
          />
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
