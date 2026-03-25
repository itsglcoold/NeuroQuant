import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPrices } from "@/lib/market/eodhd";
import { isMarketOpen } from "@/lib/market/hours";
import { Resend } from "resend";

export const runtime = "edge";

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

    // -----------------------------------------------------------------------
    // 5. Check price alerts
    // -----------------------------------------------------------------------
    const { data: activeAlerts } = await supabase
      .from("price_alerts")
      .select("id, user_id, symbol, target_price, direction")
      .eq("is_active", true);

    const triggeredAlerts: string[] = [];

    if (activeAlerts && activeAlerts.length > 0) {
      // Fetch any extra symbols needed for alerts (some may already be in priceMap)
      const alertSymbols = [...new Set((activeAlerts as { symbol: string }[]).map((a) => a.symbol))];
      const missingSymbols = alertSymbols.filter((s) => !priceMap.has(s));
      if (missingSymbols.length > 0) {
        const extraPrices = await getPrices(missingSymbols);
        for (const p of extraPrices) priceMap.set(p.symbol, p.price);
      }

      const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
      const now = new Date().toISOString();

      for (const alert of activeAlerts as { id: string; user_id: string; symbol: string; target_price: number; direction: string }[]) {
        const currentPrice = priceMap.get(alert.symbol);
        if (!currentPrice) continue;

        const triggered =
          (alert.direction === "above" && currentPrice >= alert.target_price) ||
          (alert.direction === "below" && currentPrice <= alert.target_price);

        if (!triggered) continue;

        // Mark alert as triggered
        await supabase
          .from("price_alerts")
          .update({ is_active: false, triggered_at: now })
          .eq("id", alert.id);

        triggeredAlerts.push(`${alert.symbol} ${alert.direction} ${alert.target_price}`);

        // Send email notification
        if (resend) {
          try {
            // Get user email
            const { data: profile } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", alert.user_id)
              .single();

            if (profile?.email) {
              await resend.emails.send({
                from: "NeuroQuant <alerts@neuroquant.app>",
                to: profile.email as string,
                subject: `🔔 Price Alert: ${alert.symbol} hit ${alert.target_price}`,
                html: `
                  <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                    <h2 style="color:#1d4ed8">Price Alert Triggered</h2>
                    <p>Your alert for <strong>${alert.symbol}</strong> has been triggered.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0">
                      <tr><td style="padding:8px;color:#666">Market</td><td style="padding:8px;font-weight:bold">${alert.symbol}</td></tr>
                      <tr style="background:#f9f9f9"><td style="padding:8px;color:#666">Target</td><td style="padding:8px;font-weight:bold">${alert.direction === "above" ? "≥" : "≤"} ${alert.target_price}</td></tr>
                      <tr><td style="padding:8px;color:#666">Current price</td><td style="padding:8px;font-weight:bold">${currentPrice.toFixed(4)}</td></tr>
                    </table>
                    <a href="https://neuroquant.app/dashboard/market/${encodeURIComponent(alert.symbol)}"
                       style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
                      View on NeuroQuant →
                    </a>
                    <p style="color:#999;font-size:12px;margin-top:24px">This is a one-time alert. Set a new alert to be notified again.</p>
                  </div>
                `,
              });
            }
          } catch {
            // Email failure is non-critical
          }
        }
      }
    }

    return NextResponse.json({
      status: "ok",
      checked: openTrades.length,
      closed: closedTrades.length,
      closedTrades,
      alertsTriggered: triggeredAlerts.length,
      triggeredAlerts,
    });
  } catch (error) {
    console.error("Trade check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
