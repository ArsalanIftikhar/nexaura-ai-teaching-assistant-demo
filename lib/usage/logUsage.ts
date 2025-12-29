import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface UsageEvent {
  schoolId: string;
  mode: string;
  latencyMs: number;
  model: string;
  tokensEstimate?: number | null;
  costEstimateUsd?: number | null;
}

export const logUsageEvent = async ({
  schoolId,
  mode,
  latencyMs,
  model,
  tokensEstimate,
  costEstimateUsd,
}: UsageEvent) => {
  const supabase = createSupabaseAdminClient();

  await supabase.from("usage_events").insert({
    school_id: schoolId,
    mode,
    latency_ms: latencyMs,
    model,
    tokens_estimate: tokensEstimate ?? null,
    cost_estimate_usd: costEstimateUsd ?? null,
  });
};
