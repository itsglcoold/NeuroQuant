import { NextRequest, NextResponse } from "next/server";
import { getPrice, getPrices, getTimeSeries, getTechnicalIndicators } from "@/lib/market/eodhd";

export const runtime = 'edge';

// ---------------------------------------------------------------------------
// Shared cache via Cloudflare Cache API — all isolates see the same data
// This prevents multiple users from each triggering separate EODHD API calls
// ---------------------------------------------------------------------------

const CACHE_NAME = "nq-market-data";

// TTLs per data type (seconds)
const CACHE_TTLS: Record<string, number> = {
  quote: 30,           // Prices: 30 seconds (WS handles real-time anyway)
  "quote-batch": 30,   // Batch prices: same
  timeseries: 60,      // OHLCV bars: 1 minute
  indicators: 120,     // Technical indicators: 2 minutes (they use daily data)
};

/** Build a stable cache key from query params */
function buildCacheKey(params: Record<string, string>): string {
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  return `https://neuroquant.app/_internal/market-data?${new URLSearchParams(sorted)}`;
}

async function getFromCache<T>(key: string): Promise<{ data: T; age: number } | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(key);
    if (!cached) return null;
    const body = await cached.json() as { _data: T; _cachedAt: number };
    const age = (Date.now() - body._cachedAt) / 1000;
    return { data: body._data, age };
  } catch {
    return null;
  }
}

async function putInCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(
      JSON.stringify({ _data: data, _cachedAt: Date.now() }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${ttlSeconds}`,
        },
      }
    );
    await cache.put(key, response);
  } catch {
    // Silently fail — still return fresh data to this request
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const symbols = searchParams.get("symbols");
  const interval = searchParams.get("interval") || "1day";
  const type = searchParams.get("type") || "quote"; // quote, timeseries, indicators

  try {
    // ── Batch quotes (most common: dashboard loads all prices) ──
    if (type === "quote" && symbols) {
      const cacheKey = buildCacheKey({ type: "quote-batch", symbols, });
      const ttl = CACHE_TTLS["quote-batch"];

      const cached = await getFromCache(cacheKey);
      if (cached && cached.age < ttl) {
        return NextResponse.json({ data: cached.data, _cached: true });
      }

      const data = await getPrices(symbols.split(","));
      // Cache in background (don't block response)
      putInCache(cacheKey, data, ttl);
      return NextResponse.json({ data });
    }

    if (!symbol) {
      return NextResponse.json({ error: "Symbol parameter required" }, { status: 400 });
    }

    // ── Single quote ──
    if (type === "quote") {
      const cacheKey = buildCacheKey({ type: "quote", symbol });
      const ttl = CACHE_TTLS.quote;

      const cached = await getFromCache(cacheKey);
      if (cached && cached.age < ttl) {
        return NextResponse.json({ data: cached.data, _cached: true });
      }

      const data = await getPrice(symbol);
      putInCache(cacheKey, data, ttl);
      return NextResponse.json({ data });
    }

    // ── Time series (OHLCV) ──
    if (type === "timeseries") {
      const outputSize = searchParams.get("outputsize") || "30";
      const cacheKey = buildCacheKey({ type, symbol, interval, outputSize });
      const ttl = CACHE_TTLS.timeseries;

      const cached = await getFromCache(cacheKey);
      if (cached && cached.age < ttl) {
        return NextResponse.json({ data: cached.data, _cached: true });
      }

      const data = await getTimeSeries(symbol, interval, parseInt(outputSize));
      putInCache(cacheKey, data, ttl);
      return NextResponse.json({ data });
    }

    // ── Technical indicators ──
    if (type === "indicators") {
      const cacheKey = buildCacheKey({ type, symbol, interval });
      const ttl = CACHE_TTLS.indicators;

      const cached = await getFromCache(cacheKey);
      if (cached && cached.age < ttl) {
        return NextResponse.json({ data: cached.data, _cached: true });
      }

      const data = await getTechnicalIndicators(symbol, interval);
      putInCache(cacheKey, data, ttl);
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
