import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMarketScan } from "@/lib/market/scan";
import type { SuggestionsResponse } from "@/types/analysis";

export const runtime = "edge";

const FRESH_TTL_MS  = 30 * 60 * 1000; // 30 min — consider fresh
const STALE_TTL_MS  =  4 * 60 * 60 * 1000; // 4 h — still usable

// ---------------------------------------------------------------------------
// Supabase cache helpers
// ---------------------------------------------------------------------------

async function getSupabaseCache(): Promise<(SuggestionsResponse & { _scannedAt: number }) | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("market_scan_cache")
      .select("data, scanned_at")
      .eq("id", "latest")
      .single();

    if (error || !data) return null;
    return { ...data.data, _scannedAt: new Date(data.scanned_at).getTime() };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tier-based slicing helper
// ---------------------------------------------------------------------------

function sliceByTier(data: SuggestionsResponse, maxPerRow: number): SuggestionsResponse {
  return {
    ...data,
    rows: data.rows.map((row) => ({
      ...row,
      suggestions: row.suggestions.slice(0, maxPerRow),
    })),
    suggestions: data.rows.flatMap((r) => r.suggestions.slice(0, maxPerRow)),
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const tier = request.nextUrl.searchParams.get("tier") || "free";
  const forceRefresh = request.nextUrl.searchParams.get("force") === "true";

  if (tier === "free") {
    return NextResponse.json(
      { error: "Pro subscription required", requiredTier: "pro" },
      { status: 403 }
    );
  }

  const maxPerRow = tier === "premium" ? 5 : 3;

  // ---------------------------------------------------------------------------
  // 1. Read from Supabase cache
  // ---------------------------------------------------------------------------
  const cached = forceRefresh ? null : await getSupabaseCache();
  const ageMs = cached ? Date.now() - cached._scannedAt : Infinity;
  const isFresh = ageMs < FRESH_TTL_MS;
  const isUsable = ageMs < STALE_TTL_MS;

  // Fresh cache → return immediately
  if (cached && isFresh) {
    return NextResponse.json({ ...sliceByTier(cached, maxPerRow), _stale: false });
  }

  // Stale but usable → return stale (cron will refresh in background)
  if (cached && isUsable) {
    return NextResponse.json({ ...sliceByTier(cached, maxPerRow), _stale: true });
  }

  // ---------------------------------------------------------------------------
  // 2. No usable cache → run scan directly as last resort
  //    (should only happen on first ever load before cron has run)
  // ---------------------------------------------------------------------------
  try {
    const result = await runMarketScan(25_000);

    // Persist to Supabase so next request reads from cache
    try {
      const supabase = createAdminClient();
      await supabase
        .from("market_scan_cache")
        .upsert({ id: "latest", data: result, scanned_at: new Date().toISOString() });
    } catch (e) {
      console.error("Failed to save scan to Supabase:", e);
    }

    return NextResponse.json({ ...sliceByTier(result, maxPerRow), _stale: false });
  } catch (error) {
    console.error("Fallback scan failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Suggestions temporarily unavailable. The background scan will refresh shortly." },
      { status: 503 }
    );
  }
}
