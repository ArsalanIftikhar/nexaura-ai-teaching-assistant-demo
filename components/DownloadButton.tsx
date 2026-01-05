"use client";

import { useState } from "react";

interface Section {
  heading: string;
  content: string;
}

interface Citation {
  source: string;
  excerpt: string;
}

interface DownloadButtonProps {
  title: string;
  topic: string;
  mode: "lesson" | "resource" | "feedback";
  sections?: Section[];
  citations: Citation[];
  resource?: {
    resource_kind: "worksheet" | "mcq" | "slides_pack";
    title: string;
    teacher_instructions?: string;
    questions?: Array<{
      number: number;
      prompt?: string;
      stem?: string;
      options?: [string, string, string, string];
      correct_index?: number;
      misconception_map?: [string, string, string, string];
    }>;
    answers?: Array<{ number: number; answer: string }>;
    answer_key?: Array<{ number: number; correct_option: "A" | "B" | "C" | "D" }>;
    slides?: Array<{
      slide_number: number;
      title: string;
      bullets: string[];
      speaker_notes: string;
      suggested_visual?: string;
      check_for_understanding?: string;
    }>;
    teacher_appendix?: {
      starter_questions: Array<{ q: string; answer: string }>;
      mini_whiteboard_checks: Array<{ q: string; expected: string; common_wrong?: string }>;
      exit_ticket: { q: string; answer?: string };
    };
  };
}

export default function DownloadButton({
  title,
  topic,
  mode,
  citations,
  sections,
  resource,
}: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const body =
        mode === "resource"
          ? { title, topic, mode, citations, resource }
          : { title, topic, mode, sections, citations };

      const response = await fetch("/api/download-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Unable to generate document.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename=([^;]+)/i);
      link.download = match ? match[1].replace(/"/g, "") : "NexAura_Download.docx";
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

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
    >
      {loading ? "Preparing…" : "Download as DOCX"}
    </button>
  );
}
