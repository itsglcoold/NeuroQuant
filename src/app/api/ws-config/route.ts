import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

/**
 * Returns the EODHD WebSocket configuration for authenticated clients only.
 * Requires a valid Supabase session — unauthenticated requests are rejected.
 */
export async function GET() {
  const token = process.env.EODHD_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  // Reject unauthenticated requests so the EODHD key is never exposed to anonymous visitors
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only forex endpoint is used — indices are NOT available via WebSocket (confirmed by EODHD support)
  return NextResponse.json({
    forex: `wss://ws.eodhistoricaldata.com/ws/forex?api_token=${token}`,
  });
}
