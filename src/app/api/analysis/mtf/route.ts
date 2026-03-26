import { NextRequest } from "next/server";
import { getTimeSeries, getTechnicalIndicators } from "@/lib/market/eodhd";
import OpenAI from "openai";
import { checkAnalysisRateLimit } from "@/lib/ratelimit";

export const runtime = "edge";

const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

const TIMEFRAMES = ["1h", "4h", "1day"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

interface TFResult {
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
}

function getDeepseek() {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
  });
}

function cacheKey(symbol: string, tf: string) {
  return `https://neuroquant.app/_internal/mtf-${encodeURIComponent(symbol)}-${tf}`;
}

async function getCached(symbol: string, tf: string): Promise<TFResult | null> {
  try {
    const cache = await caches.open("nq-mtf");
    const hit = await cache.match(cacheKey(symbol, tf));
    if (!hit) return null;
    const data = await hit.json() as { result: TFResult; cachedAt: number };
    if (Date.now() - data.cachedAt > CACHE_TTL_SECONDS * 1000) return null;
    return data.result;
  } catch {
    return null;
  }
}

async function setCached(symbol: string, tf: string, result: TFResult) {
  try {
    const cache = await caches.open("nq-mtf");
    await cache.put(
      cacheKey(symbol, tf),
      new Response(JSON.stringify({ result, cachedAt: Date.now() }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
        },
      })
    );
  } catch {
    // ignore
  }
}

async function analyzeTimeframe(symbol: string, tf: Timeframe): Promise<TFResult> {
  const cached = await getCached(symbol, tf);
  if (cached) return cached;

  const barCount = tf === "1h" ? 30 : tf === "4h" ? 30 : 25;
  const indicatorInterval = tf === "1day" ? "1day" : "1h";

  const [seriesResult, indicatorsResult] = await Promise.allSettled([
    getTimeSeries(symbol, tf, barCount),
    getTechnicalIndicators(symbol, indicatorInterval),
  ]);

  const series = seriesResult.status === "fulfilled" ? seriesResult.value : [];
  const indicators = indicatorsResult.status === "fulfilled" ? indicatorsResult.value : { rsi: null, macd: null, sma20: null, sma50: null, ema12: null, ema26: null, bollingerBands: null };

  // Build a compact context — just enough for direction + confidence
  const latestClose = series[0]?.close ?? 0;
  const candleSummary = series
    .slice(0, 10)
    .map((b) => `O:${b.open.toFixed(4)} H:${b.high.toFixed(4)} L:${b.low.toFixed(4)} C:${b.close.toFixed(4)}`)
    .join(" | ");

  const rsiText = indicators.rsi != null ? `RSI(14): ${indicators.rsi.toFixed(1)}` : "";
  const macdText = indicators.macd != null
    ? `MACD: ${indicators.macd.macd.toFixed(4)} Signal: ${indicators.macd.signal.toFixed(4)}`
    : "";
  const smaText = [
    indicators.sma20 != null ? `SMA20: ${indicators.sma20.toFixed(4)}` : "",
    indicators.sma50 != null ? `SMA50: ${indicators.sma50.toFixed(4)}` : "",
  ].filter(Boolean).join(" | ");

  const prompt = `You are a technical analyst. Analyze ${symbol} on the ${tf} timeframe.

Current price: ${latestClose.toFixed(4)}
Last 10 candles (newest first, OHLC): ${candleSummary}
${rsiText}
${macdText ? macdText : ""}
${smaText ? smaText : ""}

Based on the trend, momentum, and indicators, respond with ONLY this JSON (no explanation, no markdown):
{"direction":"bullish"|"bearish"|"neutral","confidence":0-100}`;

  try {
    const response = await getDeepseek().chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 30,
    });

    let content = response.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (jsonMatch) content = jsonMatch[0];

    const parsed = JSON.parse(content);
    const validDirections = ["bullish", "bearish", "neutral"];
    const result: TFResult = {
      direction: validDirections.includes(parsed.direction) ? parsed.direction : "neutral",
      confidence: typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
        : 50,
    };

    await setCached(symbol, tf, result);
    return result;
  } catch {
    return { direction: "neutral", confidence: 0 };
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkAnalysisRateLimit();
  if (!rateLimit.allowed) {
    return Response.json(
      { error: rateLimit.reason },
      { status: rateLimit.reason === "Unauthorized" ? 401 : 429 }
    );
  }

  let body: { symbol?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { symbol } = body;
  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  // Run all 3 timeframes in parallel
  const [r1h, r4h, r1d] = await Promise.all(
    TIMEFRAMES.map((tf) => analyzeTimeframe(symbol, tf))
  );

  return Response.json({
    symbol,
    results: { "1h": r1h, "4h": r4h, "1day": r1d },
  });
}
