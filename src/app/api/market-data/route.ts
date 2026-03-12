import { NextRequest, NextResponse } from "next/server";
import { getPrice, getPrices, getTimeSeries, getTechnicalIndicators } from "@/lib/market/eodhd";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const symbols = searchParams.get("symbols");
  const interval = searchParams.get("interval") || "1day";
  const type = searchParams.get("type") || "quote"; // quote, timeseries, indicators

  try {
    if (type === "quote" && symbols) {
      const data = await getPrices(symbols.split(","));
      return NextResponse.json({ data });
    }

    if (!symbol) {
      return NextResponse.json({ error: "Symbol parameter required" }, { status: 400 });
    }

    if (type === "quote") {
      const data = await getPrice(symbol);
      return NextResponse.json({ data });
    }

    if (type === "timeseries") {
      const outputSize = parseInt(searchParams.get("outputsize") || "30");
      const data = await getTimeSeries(symbol, interval, outputSize);
      return NextResponse.json({ data });
    }

    if (type === "indicators") {
      const data = await getTechnicalIndicators(symbol, interval);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("Market data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500 }
    );
  }
}
