"use client";

interface PrivacyWarningModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function PrivacyWarningModal({
  open,
  onCancel,
  onConfirm,
}: PrivacyWarningModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Personal data detected</h2>
        <p className="mt-2 text-sm text-slate-600">
          We detected possible personal data (emails, phone numbers, or identifiers). Please remove any student
          personal data. If you still want to continue, confirm below (demo only).
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Proceed (demo only)
          </button>
        </div>
      </div>
    </div>
  );
}
