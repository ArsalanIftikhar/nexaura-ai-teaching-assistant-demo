"use client";

import { useState } from "react";

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

interface OutputViewerProps {
  title?: string;
  sections?: Section[];
  slides?: SlideContent[];
  citations?: Citation[];
  error?: string | null;
  formatWarning?: boolean;
  curriculumWarning?: boolean;
  message?: string | null;
}

const footerText = "© NexAura. For school use only.";

const buildSlideText = (slide: SlideContent) => {
  const lines = [slide.title, ...slide.bullets.map((bullet) => `- ${bullet}`)];
  if (slide.checkForUnderstanding) {
    lines.push(`Check for understanding: ${slide.checkForUnderstanding}`);
  }
  if (slide.suggestedVisual) {
    lines.push(`Suggested visual: ${slide.suggestedVisual}`);
  }
  lines.push(`Speaker notes: ${slide.speakerNotes}`);
  return lines.join("\n");
};

export default function OutputViewer({
  title,
  sections,
  slides,
  citations,
  error,
  formatWarning,
  curriculumWarning,
  message,
}: OutputViewerProps) {
  const [copiedSlideIndex, setCopiedSlideIndex] = useState<number | null>(null);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        Generated content will appear here.
      </div>
    );
  }

  const handleCopySlide = async (slide: SlideContent, index: number) => {
    await navigator.clipboard.writeText(buildSlideText(slide));
    setCopiedSlideIndex(index);
    setTimeout(() => setCopiedSlideIndex(null), 1500);
  };

  const handleCopyNotes = async (slide: SlideContent, index: number) => {
    await navigator.clipboard.writeText(slide.speakerNotes);
    setCopiedSlideIndex(index);
    setTimeout(() => setCopiedSlideIndex(null), 1500);
  };

  const handleCopyAllSlides = async () => {
    if (!slides) return;
    const all = slides.map(buildSlideText).join("\n\n");
    await navigator.clipboard.writeText(all);
  };

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
      {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
      <div className="space-y-5">
        {sections.map((section, index) => (
          <div key={`${section.heading}-${index}`} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {section.heading}
            </h3>
            <p className="whitespace-pre-line text-sm text-slate-700">{section.content}</p>
          </div>
        ))}
      </div>

      {slides && slides.length > 0 ? (
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
          <p className="text-xs text-slate-500">
            This produces slide content for you to paste into PowerPoint or Google Slides.
          </p>
          <div className="grid gap-3">
            {slides.map((slide, index) => (
              <div key={`${slide.title}-${index}`} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">{slide.title}</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopySlide(slide, index)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Copy slide
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyNotes(slide, index)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Copy notes
                    </button>
                  </div>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {slide.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                {slide.checkForUnderstanding ? (
                  <p className="mt-2 text-xs text-slate-600">
                    <strong>Check for understanding:</strong> {slide.checkForUnderstanding}
                  </p>
                ) : null}
                {slide.suggestedVisual ? (
                  <p className="mt-1 text-xs text-slate-600">
                    <strong>Suggested visual:</strong> {slide.suggestedVisual}
                  </p>
                ) : null}
                <details className="mt-2 text-xs text-slate-600">
                  <summary className="cursor-pointer font-semibold">Speaker notes</summary>
                  <p className="mt-1 whitespace-pre-line">{slide.speakerNotes}</p>
                </details>
                {copiedSlideIndex === index ? (
                  <p className="mt-2 text-xs text-emerald-600">Copied!</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {citations && citations.length > 0 ? (
        <details className="border-t border-slate-200 pt-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
            Curriculum citations
          </summary>
          <ul className="mt-2 space-y-2 text-xs text-slate-600">
            {citations.map((citation, index) => (
              <li key={`${citation.source}-${index}`}>
                <span className="font-semibold text-slate-700">{citation.source}:</span> {citation.excerpt}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="text-xs text-slate-500">{footerText}</p>
    </div>
  );
}
