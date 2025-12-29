import { createSupabaseServerClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function AppPage() {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, schools(name)")
    .eq("id", sessionData.session.user.id)
    .single();

  const schoolName =
  (Array.isArray(profile?.schools)
    ? profile?.schools?.[0]?.name
    : (profile as any)?.schools?.name) ||
  (profile as any)?.school?.name ||
  profile?.school_id ||
  "Your school";

  return <DashboardClient schoolName={schoolName} />;
}
