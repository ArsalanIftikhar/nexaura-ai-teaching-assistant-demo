import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const GET = async (request: Request) => {
  if (!process.env.ADMIN_EXPORT_TOKEN) {
    return NextResponse.json({ error: "Export token not configured." }, { status: 500 });
  }

  const token = request.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_EXPORT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get("days") || "30");
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usage_events")
    .select(
      "id, school_id, mode, created_at, latency_ms, model, tokens_estimate, cost_estimate_usd, status, repair_used, topic_len, notes_len, student_text_len"
    )
    .gte("created_at", sinceDate.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to export usage." }, { status: 500 });
  }

  const header = [
    "id",
    "school_id",
    "mode",
    "created_at",
    "latency_ms",
    "model",
    "tokens_estimate",
    "cost_estimate_usd",
    "status",
    "repair_used",
    "topic_len",
    "notes_len",
    "student_text_len",
  ];

  const rows = data?.map((row) =>
    header
      .map((key) => {
        const value = row[key as keyof typeof row];
        return value === null || value === undefined
          ? ""
          : `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csv = [header.join(","), ...(rows || [])].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=usage_events.csv",
    },
  });
};
