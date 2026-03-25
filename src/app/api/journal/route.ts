import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

export const runtime = "edge";

function getDeepseek() {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    tradeId?: string;
    symbol?: string;
    side?: string;
    entryPrice?: number;
    closePrice?: number;
    pnlPercent?: number;
    slPrice?: number;
    tpPrice?: number;
    createdAt?: string;
    closedAt?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tradeId, symbol, side, entryPrice, closePrice, pnlPercent, slPrice, tpPrice, createdAt, closedAt } = body;

  if (!tradeId || !symbol || !side || entryPrice == null || closePrice == null || pnlPercent == null) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Return cached review if it already exists
  const { data: existing } = await supabase
    .from("trade_journal")
    .select("ai_review")
    .eq("trade_id", tradeId)
    .eq("user_id", user.id)
    .single();

  if (existing?.ai_review) {
    return Response.json({ review: existing.ai_review });
  }

  // Calculate holding time
  let holdingText = "";
  if (createdAt && closedAt) {
    const ms = new Date(closedAt).getTime() - new Date(createdAt).getTime();
    const minutes = Math.round(ms / 60000);
    holdingText =
      minutes < 60
        ? `${minutes} minutes`
        : minutes < 1440
        ? `${Math.round(minutes / 60)} hours`
        : `${Math.round(minutes / 1440)} days`;
  }

  const isWin = pnlPercent > 0;
  const hitSl = closePrice != null && slPrice != null &&
    ((side === "long" && closePrice <= slPrice) || (side === "short" && closePrice >= slPrice));

  const prompt = `You are a friendly trading coach for beginners. A student just closed a paper trade. Give them a short, encouraging 3-sentence review in plain English. No jargon.

Trade details:
- Market: ${symbol}
- Direction: ${side === "long" ? "BUY (expected price to rise)" : "SELL (expected price to fall)"}
- Entry: ${entryPrice}
- Stop Loss: ${slPrice ?? "n/a"}
- Take Profit: ${tpPrice ?? "n/a"}
- Close price: ${closePrice}
- Result: ${isWin ? "WIN" : pnlPercent === 0 ? "BREAK EVEN" : "LOSS"} (${pnlPercent > 0 ? "+" : ""}${pnlPercent.toFixed(2)}%)
- Closed by: ${hitSl ? "Stop Loss was hit" : isWin ? "Take Profit was hit" : "Manually closed"}
${holdingText ? `- Held for: ${holdingText}` : ""}

Write exactly 3 sentences:
1. What happened in this trade (factual, simple)
2. One thing they can learn from this
3. A short encouragement or tip for next time

Keep it under 80 words total. Be warm and supportive.`;

  try {
    const response = await getDeepseek().chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    const review = response.choices[0]?.message?.content?.trim() || "Trade completed. Keep practicing!";

    // Save to database
    await supabase.from("trade_journal").insert({
      trade_id: tradeId,
      user_id: user.id,
      ai_review: review,
    });

    return Response.json({ review });
  } catch (err) {
    console.error("Journal review error:", err);
    return Response.json({ error: "Failed to generate review" }, { status: 500 });
  }
}
