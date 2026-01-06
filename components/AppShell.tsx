"use client";

import { ReactNode, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AppShellProps {
  schoolName: string;
  children: ReactNode;
}

const SCHOOL_NAME_KEY = "nexaura_school_name";

export default function AppShell({ schoolName, children }: AppShellProps) {
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(schoolName);

  useEffect(() => {
    const stored = sessionStorage.getItem(SCHOOL_NAME_KEY);
    if (stored) {
      setDisplayName(stored);
    } else if (schoolName) {
      sessionStorage.setItem(SCHOOL_NAME_KEY, schoolName);
    }
  }, [schoolName]);

  const handleLogout = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              NexAura
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              AI Teaching Assistant Demo
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">Signed in as</p>
              <p className="text-sm font-semibold text-slate-900">
                {displayName || "School account"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {loading ? "Signing out…" : "Logout"}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
