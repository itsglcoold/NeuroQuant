import { NextRequest, NextResponse } from "next/server";
import { getPrices, getTimeSeries } from "@/lib/market/eodhd";
import { MARKETS, SCREENING_ROWS } from "@/lib/market/symbols";
import { marketScreeningPrompt, DISCLAIMER } from "@/lib/ai/prompts";
import type { MarketSuggestion, SuggestionRow, SuggestionsResponse } from "@/types/analysis";
import { detectAllPatterns } from "@/lib/candlestick-patterns";
import { calculateConfluenceScore } from "@/lib/confluence-score";
import { detectMarketRegime } from "@/lib/market-regime";
import { getATRAnalysis } from "@/lib/atr-calculator";
import OpenAI from "openai";

export const runtime = "edge";

const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes — fresh window
const STALE_TTL_SECONDS = 4 * 60 * 60; // 4 hours — serve stale up to this age
const CACHE_KEY = "https://neuroquant.app/_internal/suggestions-cache-v2";

// ---------------------------------------------------------------------------
// Shared cache helpers — all edge isolates see the same data
// ---------------------------------------------------------------------------

async function getCachedResult(): Promise<
  (SuggestionsResponse & { _cachedAt?: number }) | null
> {
  try {
    const cache = await caches.open("nq-suggestions");
    const cached = await cache.match(CACHE_KEY);
    if (!cached) return null;
    return cached.json();
  } catch {
    return null;
  }
}

async function setCachedResult(data: SuggestionsResponse): Promise<void> {
  try {
    const cache = await caches.open("nq-suggestions");
    const enriched = { ...data, _cachedAt: Date.now() };
    const response = new Response(JSON.stringify(enriched), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${STALE_TTL_SECONDS}`,
      },
    });
    await cache.put(CACHE_KEY, response);
  } catch {
    // Silently fail — in-memory fallback below
  }
}

// In-memory fallback (per-isolate, used if Cache API unavailable)
let memoryCache: {
  data: SuggestionsResponse;
  cachedAt: number;
} | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSentimentLabel(score: number): string {
  if (score >= 60) return "Strong Bullish Momentum";
  if (score >= 30) return "Moderate Bullish";
  if (score >= 10) return "Slightly Bullish";
  if (score > -10) return "Neutral";
  if (score > -30) return "Slightly Bearish";
  if (score > -60) return "Moderate Bearish";
  return "Strong Bearish Exhaustion";
}

function getDeepSeekClient() {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
  });
}

function getQwenClient() {
  return new OpenAI({
    baseURL: "https://ws-cs1xxjuyessure89.eu-central-1.maas.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.QWEN_API_KEY || "",
  });
}

type RawSuggestion = {
  symbol: string;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  sentiment: number;
  timeframe: string;
  reasoning: string;
  keyLevel: number;
};

type ParsedGroups = {
  scalping: RawSuggestion[];
  daytrading: RawSuggestion[];
  swing: RawSuggestion[];
};

// All 28 markets grouped by trading style
// Scalping: high-liquidity, tight-spread markets
// Day Trading: major forex + oil + active JPY crosses
// Swing: all remaining forex pairs including crosses
const ALL_MARKETS_BY_STYLE = {
  scalping: ["IXIC", "SPX", "XAU/USD", "DXY", "EUR/USD"],
  daytrading: ["GBP/USD", "USD/JPY", "CL", "EUR/JPY", "GBP/JPY", "AUD/JPY", "NZD/JPY", "CAD/JPY"],
  swing: [
    "XAG/USD", "AUD/USD", "USD/CAD", "NZD/USD", "USD/CHF",
    "EUR/GBP", "GBP/AUD", "GBP/NZD", "GBP/CAD", "GBP/CHF",
    "AUD/CAD", "AUD/CHF", "AUD/NZD", "EUR/AUD", "NZD/CAD",
  ],
} as const;

const ALL_MARKETS_FLAT = [
  ...ALL_MARKETS_BY_STYLE.scalping,
  ...ALL_MARKETS_BY_STYLE.daytrading,
  ...ALL_MARKETS_BY_STYLE.swing,
]; // 28 markets

/** Build a symbol→row lookup for fallback splitting */
const symbolToRow = new Map<string, keyof ParsedGroups>();
for (const [style, symbols] of Object.entries(ALL_MARKETS_BY_STYLE)) {
  for (const sym of symbols) {
    symbolToRow.set(sym, style as keyof ParsedGroups);
  }
}

function parseScreeningResponse(content: string): ParsedGroups {
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) content = codeBlockMatch[1].trim();

  try {
    const parsed = JSON.parse(content);

    // New structured format: { scalping: [...], daytrading: [...], swing: [...] }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        scalping: Array.isArray(parsed.scalping) ? parsed.scalping : [],
        daytrading: Array.isArray(parsed.daytrading) ? parsed.daytrading : [],
        swing: Array.isArray(parsed.swing) ? parsed.swing : [],
      };
    }

    // Backwards compat: flat array → split by symbol→row mapping
    if (Array.isArray(parsed)) {
      const groups: ParsedGroups = { scalping: [], daytrading: [], swing: [] };
      for (const s of parsed) {
        const rowKey = symbolToRow.get(s.symbol);
        if (rowKey) groups[rowKey].push(s);
      }
      return groups;
    }

    return { scalping: [], daytrading: [], swing: [] };
  } catch {
    return { scalping: [], daytrading: [], swing: [] };
  }
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Indicator calculations from OHLC bars
// ---------------------------------------------------------------------------

type OHLCBar = { datetime: string; open: number; high: number; low: number; close: number };
type BarsMap = Map<string, OHLCBar[]>;

interface IndicatorSummary {
  rsi: number;
  sma20: number | null;
  sma50: number | null;
  macd: "bullish" | "bearish" | "flat";
  bbPos: "near_upper" | "upper_half" | "mid" | "lower_half" | "near_lower";
}

function _calcEMA(values: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) ema = values[i] * k + ema * (1 - k);
  return ema;
}

function _calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return Math.round(100 - 100 / (1 + avgGain / avgLoss));
}

function _calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function _calcMACDDirection(closes: number[]): "bullish" | "bearish" | "flat" {
  if (closes.length < 27) return "flat";
  const ema12 = _calcEMA(closes.slice(-12), 12);
  const ema26 = _calcEMA(closes.slice(-26), 26);
  const macd = ema12 - ema26;
  const threshold = closes[closes.length - 1] * 0.0001;
  if (macd > threshold) return "bullish";
  if (macd < -threshold) return "bearish";
  return "flat";
}

function _calcBBPosition(closes: number[]): IndicatorSummary["bbPos"] {
  if (closes.length < 20) return "mid";
  const sma = _calcSMA(closes, 20)!;
  const std = Math.sqrt(closes.slice(-20).reduce((s, c) => s + (c - sma) ** 2, 0) / 20);
  const upper = sma + 2 * std;
  const lower = sma - 2 * std;
  const range = upper - lower;
  if (range === 0) return "mid";
  const pos = (closes[closes.length - 1] - lower) / range;
  if (pos >= 0.85) return "near_upper";
  if (pos >= 0.55) return "upper_half";
  if (pos >= 0.45) return "mid";
  if (pos >= 0.15) return "lower_half";
  return "near_lower";
}

function calcIndicators(bars: OHLCBar[]): IndicatorSummary {
  const closes = bars.map(b => b.close);
  return {
    rsi: _calcRSI(closes),
    sma20: _calcSMA(closes, 20),
    sma50: _calcSMA(closes, 50),
    macd: _calcMACDDirection(closes),
    bbPos: _calcBBPosition(closes),
  };
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 10) return n.toFixed(3);
  return n.toFixed(5);
}

async function prefetchBarsForGroup(
  symbols: readonly string[],
  timeframe: string
): Promise<BarsMap> {
  const map: BarsMap = new Map();
  await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        const bars = await getTimeSeries(symbol, timeframe, 60);
        if (bars && bars.length >= 20) map.set(symbol, bars);
      } catch { /* best-effort */ }
    })
  );
  return map;
}

// ---------------------------------------------------------------------------
// Core screening logic
// ---------------------------------------------------------------------------

function mergeGroupSuggestions(
  deepseekGroup: RawSuggestion[],
  qwenGroup: RawSuggestion[]
): RawSuggestion[] {
  const scoreMap = new Map<string, RawSuggestion & { sources: number }>();

  for (const s of deepseekGroup) {
    scoreMap.set(s.symbol, { ...s, sources: 1 });
  }
  for (const s of qwenGroup) {
    const existing = scoreMap.get(s.symbol);
    if (existing) {
      existing.confidence = Math.min(
        100,
        Math.round(((existing.confidence + s.confidence) / 2) * 1.15)
      );
      existing.sentiment = Math.round(
        (existing.sentiment + s.sentiment) / 2
      );
      existing.sources = 2;
      if (s.reasoning.length > existing.reasoning.length) {
        existing.reasoning = s.reasoning;
      }
    } else {
      scoreMap.set(s.symbol, { ...s, sources: 1 });
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.sources - a.sources || b.confidence - a.confidence);
}

// ---------------------------------------------------------------------------
// OHLC enrichment — candlestick patterns + regime + confluence
// ---------------------------------------------------------------------------

interface EnrichmentData {
  candlestickPattern?: MarketSuggestion["candlestickPattern"];
  confluenceScore?: number;
  confluenceGrade?: "Excellent" | "Good" | "Moderate" | "Poor";
  marketRegime?: string;
  adx?: number;
  recommendation?: string;
}

function calculateSwingSR(bars: Array<{ high: number; low: number }>): { support: number[]; resistance: number[] } {
  const support: number[] = [];
  const resistance: number[] = [];
  for (let i = 2; i < bars.length - 2; i++) {
    if (bars[i].low < bars[i-1].low && bars[i].low < bars[i-2].low &&
        bars[i].low < bars[i+1].low && bars[i].low < bars[i+2].low) {
      support.push(bars[i].low);
    }
    if (bars[i].high > bars[i-1].high && bars[i].high > bars[i-2].high &&
        bars[i].high > bars[i+1].high && bars[i].high > bars[i+2].high) {
      resistance.push(bars[i].high);
    }
  }
  return { support: support.slice(-3), resistance: resistance.slice(0, 3) };
}

// Timeframe to use per trading style for OHLC enrichment
const STYLE_OHLC_TIMEFRAME: Record<string, string> = {
  scalping: "5min",
  daytrading: "1h",
  swing: "4h",
};

async function enrichSymbols(
  suggestions: RawSuggestion[],
  styleKey: string,
  prefetchedBars?: BarsMap
): Promise<Map<string, EnrichmentData>> {
  const map = new Map<string, EnrichmentData>();
  if (suggestions.length === 0) return map;
  const timeframe = STYLE_OHLC_TIMEFRAME[styleKey] || "4h";

  await Promise.allSettled(
    suggestions.map(async (raw) => {
      try {
        const bars = prefetchedBars?.get(raw.symbol) ?? await getTimeSeries(raw.symbol, timeframe, 50);
        if (!bars || bars.length < 20) return;

        const patterns = detectAllPatterns(bars);
        const topPattern = patterns[0] ?? null;
        const regime = detectMarketRegime(bars, raw.symbol);
        const atr = getATRAnalysis(bars, raw.symbol);

        const currentPrice = bars[bars.length - 1].close;
        const { support, resistance } = calculateSwingSR(bars);
        const atSupport = support.some(p => Math.abs(currentPrice - p) / currentPrice < 0.005);
        const atResistance = resistance.some(p => Math.abs(currentPrice - p) / currentPrice < 0.005);

        const confluence = calculateConfluenceScore({
          adx: regime.adx,
          isTrending: regime.regime === "trending",
          trendDirection: raw.direction,
          multiTfAlignment: Math.min(90, raw.confidence),
          atSupport,
          atResistance,
          levelStrength: (atSupport || atResistance) ? 70 : 35,
          pattern: topPattern ? { name: topPattern.name, type: topPattern.type, confidence: topPattern.confidence } : null,
          atrRatio: atr.ratio,
        });

        map.set(raw.symbol, {
          candlestickPattern: topPattern ? { name: topPattern.name, type: topPattern.type, confidence: topPattern.confidence, description: topPattern.description } : undefined,
          confluenceScore: confluence.score,
          confluenceGrade: confluence.grade,
          marketRegime: regime.regime,
          adx: regime.adx,
          recommendation: confluence.recommendation,
        });
      } catch {
        // Silent — enrichment is best-effort, never blocks suggestions
      }
    })
  );

  return map;
}

function rawToMarketSuggestion(raw: RawSuggestion, enrichment?: EnrichmentData): MarketSuggestion {
  const market = MARKETS.find((m) => m.symbol === raw.symbol);
  return {
    symbol: raw.symbol,
    name: market?.name ?? raw.symbol,
    emoji: market?.emoji ?? "",
    category: market?.category ?? "forex",
    direction: raw.direction,
    confidence: Math.min(100, Math.max(0, raw.confidence || 0)),
    sentiment: Math.min(100, Math.max(-100, raw.sentiment || 0)),
    sentimentLabel: getSentimentLabel(raw.sentiment || 0),
    probabilityAlignment: Math.min(100, Math.max(0, raw.confidence || 0)),
    timeframe: raw.timeframe || "Both",
    reasoning: raw.reasoning || "",
    keyLevel: raw.keyLevel || 0,
    ...enrichment,
  };
}

async function runScreening(timeoutMs: number = 90_000): Promise<SuggestionsResponse> {
  // Fetch prices + OHLC bars for ALL 28 markets in parallel
  const [pricesArray, scalpingBars, daytradingBars, swingBars] = await Promise.all([
    getPrices([...ALL_MARKETS_FLAT]),
    prefetchBarsForGroup(ALL_MARKETS_BY_STYLE.scalping, STYLE_OHLC_TIMEFRAME.scalping),
    prefetchBarsForGroup(ALL_MARKETS_BY_STYLE.daytrading, STYLE_OHLC_TIMEFRAME.daytrading),
    prefetchBarsForGroup(ALL_MARKETS_BY_STYLE.swing, STYLE_OHLC_TIMEFRAME.swing),
  ]);

  const priceMap = new Map(pricesArray.map((p) => [p.symbol, p]));
  const allBars: Record<string, BarsMap> = {
    scalping: scalpingBars,
    daytrading: daytradingBars,
    swing: swingBars,
  };

  // Build context grouped by trading style — includes technical indicators
  const STYLE_LABELS: Record<string, { label: string; timeframe: string }> = {
    scalping:   { label: "SCALPING",    timeframe: "1m / 5m" },
    daytrading: { label: "DAY TRADING", timeframe: "15m / 1H" },
    swing:      { label: "SWING TRADING", timeframe: "4H / Daily" },
  };

  let context = `MARKET SCREENING DATA (${ALL_MARKETS_FLAT.length} markets in 3 groups):\n\n`;

  for (const [style, symbols] of Object.entries(ALL_MARKETS_BY_STYLE)) {
    const meta = STYLE_LABELS[style];
    const barsMap = allBars[style];
    context += `--- ${meta.label} (${meta.timeframe}) ---\n`;
    context += `Symbol | Price | Change% | High | Low | RSI | MACD | BB | SMA20 | SMA50\n`;
    for (const symbol of symbols) {
      const p = priceMap.get(symbol);
      if (!p || p.price === 0) continue;
      const bars = barsMap?.get(symbol);
      const ind = bars ? calcIndicators(bars) : null;
      let line = `${symbol} | ${p.price} | ${p.changePercent.toFixed(2)}%`;
      line += ` | H:${p.high} L:${p.low}`;
      if (ind) {
        line += ` | RSI:${ind.rsi}`;
        line += ` | MACD:${ind.macd}`;
        line += ` | BB:${ind.bbPos}`;
        if (ind.sma20) line += ` | SMA20:${fmtPrice(ind.sma20)}`;
        if (ind.sma50) line += ` | SMA50:${fmtPrice(ind.sma50)}`;
      }
      context += line + `\n`;
    }
    context += `\n`;
  }

  const userMessage = `Screen these markets grouped by trading style. Analyze each group through its designated timeframe lens:\n\n${context}`;
  const systemMessage = marketScreeningPrompt();

  // Run DeepSeek + Qwen in parallel with individual timeouts
  const perModelTimeout = Math.min(timeoutMs - 5000, 60_000);

  const [deepseekRes, qwenRes] = await Promise.allSettled([
    withTimeout(
      getDeepSeekClient().chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
      perModelTimeout
    ),
    withTimeout(
      (() => {
        // Disable Qwen3 thinking mode — enable_thinking is not in OpenAI types so injected via Object.assign
        const p: OpenAI.ChatCompletionCreateParamsNonStreaming = {
          model: "qwen3.6-plus",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: 2000,
          stream: false,
        };
        Object.assign(p, { enable_thinking: false });
        return getQwenClient().chat.completions.create(p);
      })(),
      perModelTimeout
    ),
  ]);

  const deepseekGroups =
    deepseekRes.status === "fulfilled"
      ? parseScreeningResponse(
          deepseekRes.value.choices[0]?.message?.content || "{}"
        )
      : { scalping: [], daytrading: [], swing: [] };
  const qwenGroups =
    qwenRes.status === "fulfilled"
      ? parseScreeningResponse(
          qwenRes.value.choices[0]?.message?.content || "{}"
        )
      : { scalping: [], daytrading: [], swing: [] };

  // Check if both models returned nothing
  const totalResults =
    deepseekGroups.scalping.length + deepseekGroups.daytrading.length + deepseekGroups.swing.length +
    qwenGroups.scalping.length + qwenGroups.daytrading.length + qwenGroups.swing.length;

  if (totalResults === 0) {
    throw new Error("Both AI models returned no results");
  }

  // Merge each group independently — consensus boost per group
  const mergedScalping = mergeGroupSuggestions(deepseekGroups.scalping, qwenGroups.scalping);
  const mergedDaytrading = mergeGroupSuggestions(deepseekGroups.daytrading, qwenGroups.daytrading);
  const mergedSwing = mergeGroupSuggestions(deepseekGroups.swing, qwenGroups.swing);

  // Enrich suggestions — reuse pre-fetched bars (no duplicate OHLC requests)
  const [scalpingEnrich, daytradingEnrich, swingEnrich] = await Promise.all([
    enrichSymbols(mergedScalping, "scalping", scalpingBars),
    enrichSymbols(mergedDaytrading, "daytrading", daytradingBars),
    enrichSymbols(mergedSwing, "swing", swingBars),
  ]);

  // Build rows with metadata from SCREENING_ROWS config
  const rows: SuggestionRow[] = [
    {
      key: SCREENING_ROWS[0].key,
      label: SCREENING_ROWS[0].label,
      subtitle: SCREENING_ROWS[0].subtitle,
      timeframeFocus: SCREENING_ROWS[0].timeframeFocus,
      badgeColor: SCREENING_ROWS[0].badgeColor,
      suggestions: mergedScalping.map(s => rawToMarketSuggestion(s, scalpingEnrich.get(s.symbol))),
    },
    {
      key: SCREENING_ROWS[1].key,
      label: SCREENING_ROWS[1].label,
      subtitle: SCREENING_ROWS[1].subtitle,
      timeframeFocus: SCREENING_ROWS[1].timeframeFocus,
      badgeColor: SCREENING_ROWS[1].badgeColor,
      suggestions: mergedDaytrading.map(s => rawToMarketSuggestion(s, daytradingEnrich.get(s.symbol))),
    },
    {
      key: SCREENING_ROWS[2].key,
      label: SCREENING_ROWS[2].label,
      subtitle: SCREENING_ROWS[2].subtitle,
      timeframeFocus: SCREENING_ROWS[2].timeframeFocus,
      badgeColor: SCREENING_ROWS[2].badgeColor,
      suggestions: mergedSwing.map(s => rawToMarketSuggestion(s, swingEnrich.get(s.symbol))),
    },
  ];

  const allSuggestions = rows.flatMap((r) => r.suggestions);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_SECONDS * 1000);

  return {
    rows,
    suggestions: allSuggestions,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    disclaimer: DISCLAIMER,
    marketsScanned: ALL_MARKETS_FLAT.length,
  };
}

// ---------------------------------------------------------------------------
// Tier-based slicing helper
// ---------------------------------------------------------------------------

function sliceByTier(data: SuggestionsResponse, maxPerRow: number): SuggestionsResponse {
  return {
    ...data,
    rows: data.rows.map((row) => ({
      ...row,
      suggestions: row.suggestions.slice(0, maxPerRow),
    })),
    suggestions: data.rows.flatMap((r) => r.suggestions.slice(0, maxPerRow)),
  };
}

// ---------------------------------------------------------------------------
// GET handler — stale-while-revalidate
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const tier = request.nextUrl.searchParams.get("tier") || "free";
  const forceRefresh = request.nextUrl.searchParams.get("force") === "true";

  if (tier === "free") {
    return NextResponse.json(
      { error: "Pro subscription required", requiredTier: "pro" },
      { status: 403 }
    );
  }

  const maxPerRow = tier === "premium" ? 5 : 3;

  // ---------------------------------------------------------------------------
  // 1. Check all caches (skip if force refresh)
  // ---------------------------------------------------------------------------
  const cached = forceRefresh ? null : await getCachedResult();
  const cachedAt = cached?._cachedAt ?? 0;
  const ageMs = Date.now() - cachedAt;
  const isFresh = cachedAt > 0 && ageMs < CACHE_TTL_SECONDS * 1000;
  const isUsable = cachedAt > 0 && ageMs < STALE_TTL_SECONDS * 1000;

  const memCachedAt = forceRefresh ? 0 : (memoryCache?.cachedAt ?? 0);
  const memAgeMs = Date.now() - memCachedAt;
  const memIsFresh = memCachedAt > 0 && memAgeMs < CACHE_TTL_SECONDS * 1000;
  const memIsUsable = memCachedAt > 0 && memAgeMs < STALE_TTL_SECONDS * 1000;

  // Pick the best available data
  const bestCached = forceRefresh ? null : (cached ?? memoryCache?.data ?? null);
  const bestIsFresh = cached ? isFresh : memIsFresh;
  const bestIsUsable = cached ? isUsable : memIsUsable;

  // ---------------------------------------------------------------------------
  // 2. FRESH cache → return immediately
  // ---------------------------------------------------------------------------
  if (bestCached && bestIsFresh) {
    return NextResponse.json({
      ...sliceByTier(bestCached, maxPerRow),
      _stale: false,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. STALE but usable cache → return stale data immediately
  // ---------------------------------------------------------------------------
  if (bestCached && bestIsUsable) {
    return NextResponse.json({
      ...sliceByTier(bestCached, maxPerRow),
      _stale: true,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. NO usable cache → must scan now
  // ---------------------------------------------------------------------------
  try {
    const result = await runScreening(90_000);

    await setCachedResult(result);
    memoryCache = { data: result, cachedAt: Date.now() };

    return NextResponse.json({
      ...sliceByTier(result, maxPerRow),
      _stale: false,
    });
  } catch (error) {
    // If scan fails but we have ANY old cached data, return it rather than error
    if (bestCached) {
      return NextResponse.json({
        ...sliceByTier(bestCached, maxPerRow),
        _stale: true,
      });
    }
    console.error("Suggestions API error:", error);
    return NextResponse.json(
      { error: "Suggestions temporarily unavailable" },
      { status: 503 }
    );
  }
}
