import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

// GET — list user's active alerts
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, symbol, target_price, direction, is_active, triggered_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: "Database error" }, { status: 500 });
  return Response.json({ alerts: data });
}

// POST — create a new alert
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { symbol?: string; targetPrice?: number; direction?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { symbol, targetPrice, direction } = body;

  if (!symbol || targetPrice == null || !["above", "below"].includes(direction ?? "")) {
    return Response.json({ error: "symbol, targetPrice, and direction (above/below) required" }, { status: 400 });
  }

  // Limit: max 10 active alerts per user
  const { count } = await supabase
    .from("price_alerts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if ((count ?? 0) >= 10) {
    return Response.json({ error: "Maximum 10 active alerts" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("price_alerts")
    .insert({ user_id: user.id, symbol, target_price: targetPrice, direction })
    .select("id, symbol, target_price, direction, created_at")
    .single();

  if (error) return Response.json({ error: "Failed to create alert" }, { status: 500 });
  return Response.json({ alert: data });
}

// DELETE — remove an alert
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  await supabase.from("price_alerts").delete().eq("id", id).eq("user_id", user.id);
  return Response.json({ ok: true });
}
