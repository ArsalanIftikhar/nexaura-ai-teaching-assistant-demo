"use client";

import { useState } from "react";

interface Citation {
  source: string;
  excerpt: string;
}

type ResourceOutput =
  | {
      resource_kind: "worksheet";
      title: string;
      teacher_instructions: string;
      questions: Array<{ number: number; prompt: string }>;
      answers: Array<{ number: number; answer: string }>;
      citations: Citation[];
    }
  | {
      resource_kind: "mcq";
      title: string;
      teacher_instructions: string;
      questions: Array<{
        number: number;
        stem: string;
        options: [string, string, string, string];
        correct_index: number;
        explanation: string;
      }>;
      answer_key: Array<{ number: number; correct_option: "A" | "B" | "C" | "D" }>;
      citations: Citation[];
    }
  | {
      resource_kind: "slides_pack";
      title: string;
      slides: Array<{
        slide_number: number;
        title: string;
        bullets: string[];
        speaker_notes: string;
        suggested_visual?: string;
        check_for_understanding?: string;
      }>;
      teacher_appendix: {
        starter_questions: Array<{ q: string; answer: string }>;
        mini_whiteboard_checks: Array<{ q: string; expected: string; common_wrong?: string }>;
        exit_ticket: { q: string; answer?: string };
        differentiation_note: string;
      };
      citations: Citation[];
    };

interface ResourceOutputViewerProps {
  output: ResourceOutput;
  error?: string | null;
  formatWarning?: boolean;
  curriculumWarning?: boolean;
  message?: string | null;
}

const footerText = "© NexAura. For school use only.";

const buildSlideText = (slide: {
  slide_number: number;
  title: string;
  bullets: string[];
  speaker_notes: string;
  suggested_visual?: string;
  check_for_understanding?: string;
}) => {
  const lines = [`Slide ${slide.slide_number}: ${slide.title}`, ...slide.bullets.map((b) => `- ${b}`)];
  if (slide.check_for_understanding) {
    lines.push(`Check for understanding: ${slide.check_for_understanding}`);
  }
  if (slide.suggested_visual) {
    lines.push(`Suggested visual: ${slide.suggested_visual}`);
  }
  lines.push(`Speaker notes: ${slide.speaker_notes}`);
  return lines.join("\n");
};

export default function ResourceOutputViewer({
  output,
  error,
  formatWarning,
  curriculumWarning,
  message,
}: ResourceOutputViewerProps) {
  const [copiedSlideIndex, setCopiedSlideIndex] = useState<number | null>(null);

  const handleCopySlide = async (
    slide: {
      slide_number: number;
      title: string;
      bullets: string[];
      speaker_notes: string;
      suggested_visual?: string;
      check_for_understanding?: string;
    },
    index: number
  ) => {
    await navigator.clipboard.writeText(buildSlideText(slide));
    setCopiedSlideIndex(index);
    setTimeout(() => setCopiedSlideIndex(null), 1500);
  };

  const handleCopyAllSlides = async () => {
    if (output.resource_kind !== "slides_pack") return;
    const all = output.slides.map(buildSlideText).join("\n\n");
    await navigator.clipboard.writeText(all);
  };

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {error ? (
        (() => {
          const [summary, ...detailLines] = error.split("\n");
          const detailText = detailLines.join("\n").trim();
          return (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <p className="font-semibold text-red-700">{summary}</p>
              {detailText ? (
                <details className="mt-2 text-xs text-red-700">
                  <summary className="cursor-pointer font-semibold">Details</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-red-700">
                    {detailText}
                  </pre>
                </details>
              ) : null}
            </div>
          );
        })()
      ) : null}
      {formatWarning || message ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {message ||
            "We couldn’t format the response into the required structure. We attempted an automatic repair. If this persists, simplify the topic or try again."}
        </div>
      ) : null}
      {curriculumWarning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Limited curriculum alignment: no close match found in the selected curriculum documents.
        </div>
      ) : null}

      <h2 className="text-lg font-semibold text-slate-900">{output.title}</h2>

      {output.resource_kind === "worksheet" ? (
        <div className="space-y-5 text-sm text-slate-700">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Teacher instructions
            </h3>
            <p className="mt-2 whitespace-pre-line">{output.teacher_instructions}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Questions
            </h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {output.questions.map((question) => (
                <li key={question.number}>
                  {question.prompt}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Answers
            </h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {output.answers.map((answer) => (
                <li key={answer.number}>{answer.answer}</li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      {output.resource_kind === "mcq" ? (
        <div className="space-y-5 text-sm text-slate-700">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Teacher instructions
            </h3>
            <p className="mt-2 whitespace-pre-line">{output.teacher_instructions}</p>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">MCQs</h3>
            {output.questions.map((question) => (
              <div key={question.number} className="rounded-lg border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">
                  {question.number}. {question.stem}
                </p>
                <ol className="mt-2 list-[upper-alpha] space-y-1 pl-5">
                  {question.options.map((option, index) => (
                    <li key={`${question.number}-${index}`}>{option}</li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-slate-600">
                  <strong>Explanation:</strong> {question.explanation}
                </p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Answer key
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {output.answer_key.map((entry) => (
                <li key={entry.number}>
                  {entry.number}. {entry.correct_option}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {output.resource_kind === "slides_pack" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Slides content pack
            </h3>
            <button
              type="button"
              onClick={handleCopyAllSlides}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Copy all slides
            </button>
          </div>
          <div className="grid gap-3">
            {output.slides.map((slide, index) => (
              <div key={`${slide.slide_number}-${slide.title}`} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Slide {slide.slide_number}: {slide.title}
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleCopySlide(slide, index)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Copy slide
                  </button>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {slide.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                {slide.check_for_understanding ? (
                  <p className="mt-2 text-xs text-slate-600">
                    <strong>Check for understanding:</strong> {slide.check_for_understanding}
                  </p>
                ) : null}
                {slide.suggested_visual ? (
                  <p className="mt-1 text-xs text-slate-600">
                    <strong>Suggested visual:</strong> {slide.suggested_visual}
                  </p>
                ) : null}
                <details className="mt-2 text-xs text-slate-600">
                  <summary className="cursor-pointer font-semibold">Speaker notes</summary>
                  <p className="mt-1 whitespace-pre-line">{slide.speaker_notes}</p>
                </details>
                {copiedSlideIndex === index ? (
                  <p className="mt-2 text-xs text-emerald-600">Copied!</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Teacher appendix
            </h4>
            <div className="mt-3 space-y-3">
              <p className="text-xs font-semibold text-slate-600">
                {output.teacher_appendix.differentiation_note}
              </p>
              <div>
                <p className="text-xs font-semibold text-slate-600">Starter questions</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {output.teacher_appendix.starter_questions.map((item, index) => (
                    <li key={`${item.q}-${index}`}>
                      {item.q} — <span className="text-slate-500">{item.answer}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Mini whiteboard checks</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {output.teacher_appendix.mini_whiteboard_checks.map((item, index) => (
                    <li key={`${item.q}-${index}`}>
                      {item.q} — <span className="text-slate-500">{item.expected}</span>
                      {item.common_wrong ? (
                        <span className="text-slate-400"> (Common wrong: {item.common_wrong})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Exit ticket</p>
                <p className="mt-1">
                  {output.teacher_appendix.exit_ticket.q}
                  {output.teacher_appendix.exit_ticket.answer ? (
                    <span className="text-slate-500">
                      {" "}
                      — {output.teacher_appendix.exit_ticket.answer}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {output.citations && output.citations.length > 0 ? (
        <details className="border-t border-slate-200 pt-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
            Curriculum citations
          </summary>
          <ul className="mt-2 space-y-2 text-xs text-slate-600">
            {output.citations.map((citation, index) => (
              <li key={`${citation.source}-${index}`}>
                <span className="font-semibold text-slate-700">{citation.source}:</span>{" "}
                {citation.excerpt}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="text-xs text-slate-500">{footerText}</p>
    </div>
  );
}
