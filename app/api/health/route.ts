import { NextResponse } from "next/server";
import { retrieveCurriculumSnippets } from "@/lib/curriculum/retrieve";

export const GET = async (request: Request) => {
  if (!process.env.ADMIN_EXPORT_TOKEN) {
    return NextResponse.json({ error: "Export token not configured." }, { status: 500 });
  }

  const token = request.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_EXPORT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const curriculumLoaded =
    retrieveCurriculumSnippets("curriculum", "national_pk").length > 0;

  return NextResponse.json({
    ok: true,
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    curriculumLoaded,
    version: process.env.VERCEL_GIT_COMMIT_SHA || "local",
  });
};
