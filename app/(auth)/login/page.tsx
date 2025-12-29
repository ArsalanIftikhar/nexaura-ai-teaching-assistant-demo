import AuthLoginForm from "@/components/AuthLoginForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    redirect("/app");
  }

  const showSignup = process.env.DISABLE_SIGNUP !== "true";

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-indigo-600">NexAura</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Sign in to your school workspace
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            One login per school. No teachers, no selectors—just your school demo access.
          </p>
        </div>
        <AuthLoginForm showSignup={showSignup} />
      </div>
    </div>
  );
}
