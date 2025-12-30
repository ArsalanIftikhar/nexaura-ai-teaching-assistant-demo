import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface UsageEvent {
  schoolId: string;
  mode: string;
  latencyMs: number;
  model: string;
  tokensEstimate?: number | null;
  costEstimateUsd?: number | null;
  status: "success" | "fail" | "parse_fail" | "rate_limited";
  repairUsed?: boolean;
  topicLen?: number;
  notesLen?: number;
  studentTextLen?: number;
}

export const logUsageEvent = async ({
  schoolId,
  mode,
  latencyMs,
  model,
  tokensEstimate,
  costEstimateUsd,
  status,
  repairUsed,
  topicLen,
  notesLen,
  studentTextLen,
}: UsageEvent) => {
  const supabase = createSupabaseAdminClient();

  await supabase.from("usage_events").insert({
    school_id: schoolId,
    mode,
    latency_ms: latencyMs,
    model,
    tokens_estimate: tokensEstimate ?? null,
    cost_estimate_usd: costEstimateUsd ?? null,
    status,
    repair_used: repairUsed ?? false,
    topic_len: topicLen ?? null,
    notes_len: notesLen ?? null,
    student_text_len: studentTextLen ?? null,
  });
};
