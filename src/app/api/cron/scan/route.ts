import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMarketScan } from "@/lib/market/scan";
import { getMarketStatus } from "@/lib/market/holidays";

export const runtime = "edge";

// Budget: cron-job.org closes connection after 30s.
// EODHD phase: ~8s (AbortSignal.timeout(8000) per call, all parallel)
// AI phase: ~12s (max_tokens=800, reduced from 1200 to fit within 30s)
// Total: ~20s — well within the 30s window.
const SCAN_TIMEOUT_MS = 28_000;

export async function GET(request: NextRequest) {
  // Verify cron secret — rejects all unauthorized callers
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skip scan on weekends and public holidays — markets closed, no value
  const marketStatus = getMarketStatus();
  if (marketStatus.status !== "open") {
    return NextResponse.json({ skipped: true, reason: marketStatus.label });
  }

  try {
    const result = await runMarketScan(SCAN_TIMEOUT_MS);

    // Persist to Supabase — single row upsert (id = 'latest')
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("market_scan_cache")
      .upsert({ id: "latest", data: result, scanned_at: new Date().toISOString() });

    if (error) {
      console.error("Failed to save scan to Supabase:", error.message);
      return NextResponse.json({ error: "Failed to save scan result" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      scanned_at: new Date().toISOString(),
      markets: result.marketsScanned,
    });
  } catch (error) {
    console.error("Cron scan failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Scan failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
