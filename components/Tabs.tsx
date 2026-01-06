"use client";

interface TabsProps {
  active: string;
  onChange: (value: string) => void;
}

const tabs = [
  { id: "lesson", label: "Lesson Plan" },
  { id: "resource", label: "Resources" },
  { id: "feedback", label: "Feedback" },
];

export default function Tabs({ active, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
