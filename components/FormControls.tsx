"use client";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function SelectField({ id, label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor={id}>
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function TextField({ id, label, value, placeholder, onChange }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor={id}>
      {label}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

interface TextAreaFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}

export function TextAreaField({
  id,
  label,
  value,
  placeholder,
  rows = 4,
  onChange,
}: TextAreaFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor={id}>
      {label}
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}
