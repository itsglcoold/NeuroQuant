import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

// POST — queue a close_trade command for the EA to execute
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

  const { ticket } = await request.json();
  if (!ticket) return NextResponse.json({ error: "ticket required" }, { status: 400 });

  // Verify the trade belongs to this user and is open
  const { data: trade } = await supabase
    .from("mt5_trades")
    .select("id")
    .eq("user_id", user.id)
    .eq("mt5_ticket", ticket)
    .eq("status", "open")
    .single();

  if (!trade) return NextResponse.json({ error: "Trade not found or already closed" }, { status: 404 });

  const { data: command, error } = await supabase
    .from("mt5_commands")
    .insert({
      user_id: user.id,
      command_type: "close_trade",
      payload: { ticket },
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, commandId: command.id });
}
