/**
 * Server-side rate limiting for AI analysis endpoints.
 *
 * - Reads the user's REAL tier from Supabase (cannot be spoofed via request body)
 * - Uses an atomic Postgres function to check + increment in one transaction
 * - Daily limits reset at midnight UTC
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const DAILY_LIMITS: Record<string, number> = {
  free: 5,
  pro: 50,
  premium: -1, // unlimited
};

export type RateLimitResult =
  | { allowed: true;  tier: string; used: number; limit: number }
  | { allowed: false; tier: string; used: number; limit: number; reason: string };

/**
 * Check whether the currently authenticated user may perform another AI analysis.
 * Also verifies authentication — returns `allowed: false` for unauthenticated requests.
 *
 * Call this at the top of every /api/analysis/* route handler.
 * The returned `tier` is the authoritative value from the DB — use it instead of
 * anything the client sends in the request body.
 */
export async function checkAnalysisRateLimit(): Promise<RateLimitResult> {
  // Authenticate
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { allowed: false, tier: "free", used: 0, limit: 0, reason: "Unauthorized" };
  }

  // Get real tier from DB (admin client bypasses RLS)
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = profile?.subscription_tier ?? "free";
  const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.free;

  // Atomic check + increment
  const { data, error } = await admin.rpc("check_and_increment_analysis", {
    p_user_id: user.id,
    p_daily_limit: limit,
  });

  if (error || !data) {
    // DB error → fail open only for premium; block others conservatively
    console.error("[ratelimit] RPC error:", error?.message);
    if (tier === "premium") {
      return { allowed: true, tier, used: 0, limit };
    }
    return { allowed: false, tier, used: 0, limit, reason: "Rate limit check failed" };
  }

  if (!data.allowed) {
    return {
      allowed: false,
      tier,
      used: data.used as number,
      limit: data.limit as number,
      reason: `Daily limit reached (${data.used}/${data.limit === -1 ? "∞" : data.limit})`,
    };
  }

  return {
    allowed: true,
    tier,
    used: data.used as number,
    limit: data.limit as number,
  };
}
