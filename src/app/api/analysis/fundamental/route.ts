import { NextRequest, NextResponse } from "next/server";
import { analyzeFundamental } from "@/lib/ai/claude";
import { getPrice, getTechnicalIndicators } from "@/lib/market/eodhd";


export async function POST(request: NextRequest) {
  try {
    const { symbol } = await request.json();

    if (!symbol) {
      return NextResponse.json({ error: "Symbol required" }, { status: 400 });
    }

    // Get current market context
    const [price, indicators] = await Promise.all([
      getPrice(symbol),
      getTechnicalIndicators(symbol, "1day"),
    ]);

    const context = `
Current Price: ${price.price}
Daily Change: ${price.change} (${price.changePercent}%)
High: ${price.high}, Low: ${price.low}
RSI(14): ${indicators.rsi ?? "N/A"}
MACD: ${indicators.macd ? `${indicators.macd.macd.toFixed(4)} (Signal: ${indicators.macd.signal.toFixed(4)})` : "N/A"}
SMA(20): ${indicators.sma20 ?? "N/A"}
SMA(50): ${indicators.sma50 ?? "N/A"}

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
