import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

// Verify HMAC-SHA256 signature (Edge-compatible Web Crypto)
async function verifySignature(body: string, secret: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBytes = new Uint8Array(
      (signature.match(/.{2}/g) ?? []).map(b => parseInt(b, 16))
    );
    return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(body));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST — EA pushes trade events here
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Look up connection by token
  const { data: connection } = await supabase
    .from("mt5_connections")
    .select("user_id, webhook_secret, is_active")
    .eq("webhook_token", token)
    .single();

  if (!connection?.is_active) {
    return NextResponse.json({ error: "Invalid or inactive connection" }, { status: 401 });
  }

  const bodyText = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";

  // Verify HMAC signature if provided
  if (signature) {
    const valid = await verifySignature(bodyText, connection.webhook_secret, signature);
    if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { event: string; data: Record<string, unknown> };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, data } = body;
  const userId = connection.user_id;
  const now = new Date().toISOString();

  switch (event) {
    case "heartbeat":
      await supabase
        .from("mt5_connections")
        .update({ last_heartbeat: now })
        .eq("user_id", userId);
      break;

    case "account_info":
      await supabase
        .from("mt5_connections")
        .update({ account_info: data, last_heartbeat: now })
        .eq("user_id", userId);
      break;

    case "trade_open":
      await supabase
        .from("mt5_trades")
        .upsert(
          {
            user_id: userId,
            mt5_ticket: data.ticket,
            symbol: data.symbol,
            direction: data.type,
            volume: data.volume,
            open_price: data.price,
            current_price: data.current ?? data.price,
            stop_loss: data.sl ?? null,
            take_profit: data.tp ?? null,
            profit: data.profit ?? 0,
            open_time: data.time,
            status: "open",
            updated_at: now,
          },
          { onConflict: "user_id,mt5_ticket" }
        );
      break;

    case "trade_update":
      await supabase
        .from("mt5_trades")
        .update({
          current_price: data.current,
          profit: data.profit,
          stop_loss: data.sl ?? null,
          take_profit: data.tp ?? null,
          updated_at: now,
        })
        .eq("user_id", userId)
        .eq("mt5_ticket", data.ticket)
        .eq("status", "open");
      break;

    case "trade_close":
      await supabase
        .from("mt5_trades")
        .update({
          status: "closed",
          close_price: data.price,
          close_time: data.time,
          profit: data.profit,
          updated_at: now,
        })
        .eq("user_id", userId)
        .eq("mt5_ticket", data.ticket);

      // Mark matching pending command as confirmed
      await supabase
        .from("mt5_commands")
        .update({ status: "confirmed", confirmed_at: now })
        .eq("user_id", userId)
        .eq("command_type", "close_trade")
        .eq("status", "sent")
        .contains("payload", { ticket: data.ticket });
      break;
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// GET — EA polls for pending commands
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Verify secret from Authorization header
  const secret = request.headers.get("x-webhook-secret") ?? "";

  const { data: connection } = await supabase
    .from("mt5_connections")
    .select("user_id, webhook_secret, is_active")
    .eq("webhook_token", token)
    .single();

  if (!connection?.is_active) {
    return NextResponse.json({ commands: [] });
  }

  // Secret is mandatory on GET (EA must always send x-webhook-secret header)
  if (!secret || secret !== connection.webhook_secret) {
    return NextResponse.json({ error: "Invalid or missing secret" }, { status: 401 });
  }

  const { data: commands } = await supabase
    .from("mt5_commands")
    .select("*")
    .eq("user_id", connection.user_id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (commands && commands.length > 0) {
    await supabase
      .from("mt5_commands")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .in("id", commands.map(c => c.id));
  }

  return NextResponse.json({ commands: commands ?? [] });
}
