import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

// GET — return current user's MT5 connection info
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  if (profile?.subscription_tier !== "premium") {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  const { data: connection } = await supabase
    .from("mt5_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ connection: connection ?? null });
}

// POST { action: "setup" } — create or regenerate webhook credentials
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  if (profile?.subscription_tier !== "premium") {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  const { action } = await request.json();

  if (action === "setup") {
    // Generate unique token and secret using Web Crypto (Edge-compatible)
    const tokenBytes = new Uint8Array(24);
    const secretBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    crypto.getRandomValues(secretBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const secret = Array.from(secretBytes).map(b => b.toString(16).padStart(2, "0")).join("");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://neuroquant.app";
    const webhookToken = token;

    const { data: connection, error } = await supabase
      .from("mt5_connections")
      .upsert(
        {
          user_id: user.id,
          webhook_token: webhookToken,
          webhook_secret: secret,
          is_active: true,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      connection,
      webhookUrl: `${appUrl}/api/mt5/webhook/${webhookToken}`,
    });
  }

  if (action === "toggle") {
    const { is_active } = await request.json().catch(() => ({ is_active: false }));
    const { data: connection } = await supabase
      .from("mt5_connections")
      .update({ is_active })
      .eq("user_id", user.id)
      .select()
      .single();
    return NextResponse.json({ connection });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
