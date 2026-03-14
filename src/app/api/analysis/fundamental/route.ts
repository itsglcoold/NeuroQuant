import { NextRequest, NextResponse } from "next/server";
import { analyzeFundamental } from "@/lib/ai/claude";
import { getPrice, getTechnicalIndicators } from "@/lib/market/eodhd";

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    let body: { symbol?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { symbol } = body;

    if (!symbol) {
      return NextResponse.json({ error: "Symbol required" }, { status: 400 });
    }

    // Get current market context — use allSettled so one failure doesn't crash everything
    const [priceResult, indicatorsResult] = await Promise.allSettled([
      getPrice(symbol),
      getTechnicalIndicators(symbol, "1day"),
    ]);

    if (priceResult.status === "rejected") {
      throw new Error(`Failed to fetch price for ${symbol}`);
    }

    const price = priceResult.value;
    const indicators = indicatorsResult.status === "fulfilled" ? indicatorsResult.value : {
      rsi: null, macd: null, sma20: null, sma50: null, ema12: null, ema26: null, bollingerBands: null,
    };

    // Guard against NaN from parseFloat on bad API data
    const safeFixed = (val: number | null, decimals: number) =>
      val !== null && !isNaN(val) ? val.toFixed(decimals) : "N/A";

    const context = `
Current Price: ${price.price}
Daily Change: ${price.change} (${price.changePercent}%)
High: ${price.high}, Low: ${price.low}
RSI(14): ${safeFixed(indicators.rsi, 2)}
MACD: ${indicators.macd && !isNaN(indicators.macd.macd) ? `${indicators.macd.macd.toFixed(4)} (Signal: ${indicators.macd.signal.toFixed(4)})` : "N/A"}
SMA(20): ${safeFixed(indicators.sma20, 4)}
SMA(50): ${safeFixed(indicators.sma50, 4)}

Consider current macroeconomic conditions including:
- Federal Reserve monetary policy and interest rate environment
- Inflation trends in the US and globally
- Geopolitical developments affecting this market
- Recent economic data releases
- Historical seasonal patterns for this asset
`.trim();

    const analysis = await analyzeFundamental(symbol, context);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Fundamental analysis error:", error);
    return NextResponse.json(
      { error: "Failed to generate fundamental analysis" },
      { status: 500 }
    );
  }
}
