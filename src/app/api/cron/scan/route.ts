import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMarketScan } from "@/lib/market/scan";
import { getMarketStatus } from "@/lib/market/holidays";

export const runtime = "edge";

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

  // Schedule the scan to run AFTER the response is sent.
  // This is critical: cron-job.org closes the HTTP connection after 30s.
  // If we await the scan here, Cloudflare kills the worker at 30s and aborts
  // in-flight AI calls → "Connection error." With after(), the response goes
  // out immediately and the scan runs via ctx.waitUntil() with no HTTP timeout.
  after(async () => {
    try {
      const result = await runMarketScan(55_000);

      const supabase = createAdminClient();
      const { error } = await supabase
        .from("market_scan_cache")
        .upsert({ id: "latest", data: result, scanned_at: new Date().toISOString() });

      if (error) {
        console.error("Background scan: failed to save to Supabase:", error.message);
      } else {
        console.log("Background scan: saved", result.marketsScanned, "markets to Supabase");
      }
    } catch (err) {
      console.error("Background scan failed:", err instanceof Error ? err.message : err);
    }
  });

  // Return immediately — cron-job.org sees this within milliseconds, not 30+ seconds
  return NextResponse.json({
    ok: true,
    started: true,
    message: "Scan started in background",
    triggered_at: new Date().toISOString(),
  });
}
