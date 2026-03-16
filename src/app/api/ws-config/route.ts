import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * Returns the EODHD WebSocket configuration for authenticated clients.
 * The API key stays server-side until an authenticated user requests it.
 */
export async function GET() {
  const token = process.env.EODHD_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  // Only forex endpoint is used — indices are NOT available via WebSocket (confirmed by EODHD support)
  return NextResponse.json({
    forex: `wss://ws.eodhistoricaldata.com/ws/forex?api_token=${token}`,
  });
}
