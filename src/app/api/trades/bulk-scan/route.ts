import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrice, getTimeSeries, getTechnicalIndicators } from "@/lib/market/eodhd";
import { calculateATR } from "@/lib/atr-calculator";

const ATR_FALLBACK: Record<string, number> = {
  "EUR/USD": 0.0050, "GBP/USD": 0.0060, "USD/JPY": 0.50, "USD/CHF": 0.0050,
  "AUD/USD": 0.0045, "NZD/USD": 0.0045, "USD/CAD": 0.0050, "EUR/JPY": 0.60,
  "GBP/JPY": 0.70, "AUD/JPY": 0.45, "XAU/USD": 15.0, "XAG/USD": 0.30,
  "CL": 0.80, "DXY": 0.20, "IXIC": 25.0, "SPX": 20.0,
};

export const runtime = "edge";

export interface BulkScanResult {
  symbol: string;
  price: number;
  atr: number;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number; // 0–100, indicator alignment score
  signals: string[];
  error?: string;
}

const TIMEFRAME_MAP: Record<string, string> = {
  auto: "1day",
  "5m": "5min",
  "15m": "15min",
  "1H": "1h",
  "4H": "4h",
  "1D": "1day",
};

async function scanSymbol(symbol: string, timeframe: string): Promise<BulkScanResult> {
  const interval = TIMEFRAME_MAP[timeframe] ?? "1day";
  try {
    const [priceData, series, indicators] = await Promise.allSettled([
      getPrice(symbol),
      getTimeSeries(symbol, interval, 50),
      getTechnicalIndicators(symbol, interval),
    ]);

    const price =
      priceData.status === "fulfilled" ? priceData.value.price : 0;
    if (!price) return { symbol, price: 0, atr: 0, direction: "neutral", confidence: 0, signals: [], error: "No price" };

    const bars = series.status === "fulfilled" ? series.value : [];
    const atr =
      bars.length >= 15
        ? calculateATR(bars, 14)
        : ATR_FALLBACK[symbol] ?? price * 0.005;

    const ind = indicators.status === "fulfilled" ? indicators.value : null;

    const rsi = ind?.rsi ?? 50;
    const macd = ind?.macd?.macd ?? 0;
    const macdHist = ind?.macd?.histogram ?? 0;
    const sma20 = ind?.sma20 ?? price;
    const sma50 = ind?.sma50 ?? price;
    const bbMid = ind?.bollingerBands?.middle ?? price;

    let bull = 0;
    let bear = 0;
    const signals: string[] = [];

    // RSI
    if (rsi <= 30) { bull++; signals.push("RSI oversold"); }
    else if (rsi >= 70) { bear++; signals.push("RSI overbought"); }
    else if (rsi > 50) { bull++; signals.push(`RSI ${rsi.toFixed(0)}`); }
    else { bear++; signals.push(`RSI ${rsi.toFixed(0)}`); }

    // MACD line
    if (macd > 0) { bull++; signals.push("MACD+"); }
    else if (macd < 0) { bear++; signals.push("MACD-"); }

    // MACD histogram (momentum)
    if (macdHist > 0) { bull++; }
    else if (macdHist < 0) { bear++; }

    // Price vs SMA20
    if (price > sma20 * 1.0001) { bull++; signals.push("↑SMA20"); }
    else if (price < sma20 * 0.9999) { bear++; signals.push("↓SMA20"); }

    // Price vs SMA50
    if (price > sma50 * 1.0001) { bull++; signals.push("↑SMA50"); }
    else if (price < sma50 * 0.9999) { bear++; signals.push("↓SMA50"); }

    // Price vs BB mid
    if (price > bbMid) bull++;
    else bear++;

    const total = bull + bear;
    const diff = bull - bear;
    const confidence = total > 0 ? Math.round((Math.abs(diff) / total) * 100) : 0;
    const direction: "bullish" | "bearish" | "neutral" =
      diff > 0 ? "bullish" : diff < 0 ? "bearish" : "neutral";

    return { symbol, price, atr, direction, confidence, signals: signals.slice(0, 4) };
  } catch (err) {
    return { symbol, price: 0, atr: 0, direction: "neutral", confidence: 0, signals: [], error: String(err) };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { symbols?: string[]; timeframe?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { symbols = [], timeframe = "1D" } = body;
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return NextResponse.json({ error: "symbols array required" }, { status: 400 });
  }

  // Scan in parallel batches of 8
  const results: BulkScanResult[] = [];
  const BATCH = 8;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map((s) => scanSymbol(s, timeframe)));
    results.push(...batchResults);
  }

  return NextResponse.json({ results });
}
