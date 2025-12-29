"use client";

import { useState } from "react";

interface Section {
  heading: string;
  content: string;
}

interface DownloadButtonProps {
  title: string;
  topic: string;
  mode: string;
  sections: Section[];
}

export default function DownloadButton({ title, topic, mode, sections }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/download-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, topic, mode, sections }),
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
      link.download = match ? match[1].replace(/\"/g, "") : "NexAura_Download.docx";
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
