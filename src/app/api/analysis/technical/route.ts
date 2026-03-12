import { NextRequest, NextResponse } from "next/server";
import { getPrice, getTimeSeries, getTechnicalIndicators } from "@/lib/market/eodhd";
import { analyzeTechnical as deepseekAnalyze } from "@/lib/ai/deepseek";
import { analyzeTechnical as qwenAnalyze } from "@/lib/ai/qwen";
import { calculateConsensus } from "@/lib/ai/consensus";

export async function POST(request: NextRequest) {
  try {
    const { symbol } = await request.json();

    if (!symbol) {
      return NextResponse.json({ error: "Symbol required" }, { status: 400 });
    }

    // Fetch market data in parallel
    const [price, timeSeries, indicators] = await Promise.all([
      getPrice(symbol),
      getTimeSeries(symbol, "1day", 30),
      getTechnicalIndicators(symbol, "1day"),
    ]);

    const marketData = {
      symbol,
      price: price.price,
      change: price.change,
      changePercent: price.changePercent,
      timeSeries: timeSeries.map((bar) => ({
        datetime: bar.datetime,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
      indicators: {
        rsi: indicators.rsi,
        macd: indicators.macd,
        sma20: indicators.sma20,
        sma50: indicators.sma50,
        bollingerBands: indicators.bollingerBands,
      },
    };

    // Run both AI models in parallel
    const [deepseekResult, qwenResult] = await Promise.all([
      deepseekAnalyze(marketData),
      qwenAnalyze(marketData),
    ]);

    // Calculate consensus
    const consensus = calculateConsensus([deepseekResult, qwenResult]);

    return NextResponse.json({
      symbol,
      price: price,
      indicators,
      consensus,
    });
  } catch (error) {
    console.error("Technical analysis error:", error);
    return NextResponse.json(
      { error: "Failed to generate analysis" },
      { status: 500 }
    );
  }
}
