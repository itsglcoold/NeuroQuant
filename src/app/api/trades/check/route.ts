import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPrices } from "@/lib/market/eodhd";

export const runtime = "edge";

// ---------------------------------------------------------------------------
// Market hours check (Sun 22:00 – Fri 22:00 GMT)
// ---------------------------------------------------------------------------

function isMarketOpen(): boolean {
  const now = new Date();
  const d = now.getUTCDay();
  const h = now.getUTCHours();
  if (d === 6) return false; // Saturday
  if (d === 0 && h < 22) return false; // Sunday before 22:00
  if (d === 5 && h >= 22) return false; // Friday after 22:00
  return true;
}

// ---------------------------------------------------------------------------
// GET /api/trades/check — called by external cron every minute
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Auth: verify cron secret
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skip if market is closed
  if (!isMarketOpen()) {
    return NextResponse.json({ status: "skipped", reason: "market_closed" });
  }

  try {
    const supabase = createAdminClient();

    // 1. Fetch all open trades across all users
    const { data: openTrades, error: fetchError } = await supabase
      .from("paper_trades")
      .select("*")
      .eq("status", "open");

    if (fetchError) {
      console.error("Failed to fetch open trades:", fetchError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!openTrades || openTrades.length === 0) {
      return NextResponse.json({ status: "ok", checked: 0, closed: 0 });
    }

    // 2. Get unique symbols and fetch prices
    const uniqueSymbols = [...new Set(openTrades.map((t) => t.symbol as string))];
    const pricesArray = await getPrices(uniqueSymbols);
    const priceMap = new Map(pricesArray.map((p) => [p.symbol, p.price]));

    // 3. Evaluate SL/TP for each trade
    const tradesToClose: {
      id: string;
      closePrice: number;
      pnl: number;
      symbol: string;
      side: string;
    }[] = [];

    for (const trade of openTrades) {
      const currentPrice = priceMap.get(trade.symbol as string);
      if (!currentPrice || currentPrice === 0) continue;

      const entryPrice = trade.entry_price as number;
      const slPrice = trade.sl_price as number;
      const tpPrice = trade.tp_price as number;
      const side = trade.side as string;

      let shouldClose = false;
      let closePrice = currentPrice;

      if (side === "long") {
        if (currentPrice <= slPrice) {
          shouldClose = true;
          closePrice = slPrice;
        } else if (currentPrice >= tpPrice) {
          shouldClose = true;
          closePrice = tpPrice;
        }
      } else {
        // short
        if (currentPrice >= slPrice) {
          shouldClose = true;
          closePrice = slPrice;
        } else if (currentPrice <= tpPrice) {
          shouldClose = true;
          closePrice = tpPrice;
        }
      }

      if (shouldClose) {
        const pnl =
          side === "long"
            ? ((closePrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - closePrice) / entryPrice) * 100;

        tradesToClose.push({
          id: trade.id as string,
          closePrice,
          pnl: Math.round(pnl * 100) / 100,
          symbol: trade.symbol as string,
          side,
        });
      }
    }

    // 4. Batch close triggered trades
    const closedAt = new Date().toISOString();
    const closedTrades: string[] = [];

    for (const t of tradesToClose) {
      const { error: updateError } = await supabase
        .from("paper_trades")
        .update({
          status: "closed",
          close_price: t.closePrice,
          result_pnl: t.pnl,
          closed_at: closedAt,
        })
        .eq("id", t.id)
        .eq("status", "open"); // Idempotent: only close if still open

      if (!updateError) {
        closedTrades.push(`${t.symbol} ${t.side} → PnL: ${t.pnl}%`);
      }
    }

    return NextResponse.json({
      status: "ok",
      checked: openTrades.length,
      closed: closedTrades.length,
      closedTrades,
    });
  } catch (error) {
    console.error("Trade check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
