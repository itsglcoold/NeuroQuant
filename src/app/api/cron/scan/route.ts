import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMarketScan } from "@/lib/market/scan";

export const runtime = "edge";

// Maximum time for a single scan — keep under 25s to stay within Cloudflare limits
const SCAN_TIMEOUT_MS = 25_000;

export async function GET(request: NextRequest) {
  // Verify cron secret — rejects all unauthorized callers
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
