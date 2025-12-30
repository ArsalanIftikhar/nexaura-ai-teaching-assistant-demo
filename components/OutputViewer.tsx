"use client";

interface Section {
  heading: string;
  content: string;
}

interface Citation {
  source: string;
  excerpt: string;
}

interface OutputViewerProps {
  title?: string;
  sections?: Section[];
  citations?: Citation[];
  error?: string | null;
  formatWarning?: boolean;
  message?: string | null;
}

export default function OutputViewer({
  title,
  sections,
  citations,
  error,
  formatWarning,
  message,
}: OutputViewerProps) {
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

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {formatWarning || message ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {message ||
            "We couldn’t format the response into the required structure. We attempted an automatic repair. If this persists, simplify the topic or try again."}
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
    </div>
  );
}
