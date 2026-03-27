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
    baseURL: "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
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

/** Build a symbol→row lookup for fallback splitting */
const symbolToRow = new Map<string, keyof ParsedGroups>();
for (const row of SCREENING_ROWS) {
  for (const sym of row.symbols) {
    symbolToRow.set(sym, row.key);
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
  styleKey: string
): Promise<Map<string, EnrichmentData>> {
  const map = new Map<string, EnrichmentData>();
  if (suggestions.length === 0) return map;
  const timeframe = STYLE_OHLC_TIMEFRAME[styleKey] || "4h";

  await Promise.allSettled(
    suggestions.map(async (raw) => {
      try {
        const bars = await getTimeSeries(raw.symbol, timeframe, 50);
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
  // Only fetch prices for the 15 assets in SCREENING_ROWS
  const allSymbols = SCREENING_ROWS.flatMap((r) => [...r.symbols]);
  const pricesArray = await getPrices(allSymbols);
  const priceMap = new Map(pricesArray.map((p) => [p.symbol, p]));

  // Build context with group labels so AI understands the structure
  let context = `MARKET SCREENING DATA (${allSymbols.length} markets in 3 groups):\n\n`;

  for (const row of SCREENING_ROWS) {
    context += `--- ${row.label.toUpperCase()} (${row.timeframeFocus}) ---\n`;
    context += `Symbol | Price | Change% | High | Low | Open | PrevClose\n`;
    for (const symbol of row.symbols) {
      const p = priceMap.get(symbol);
      if (!p || p.price === 0) continue;
      context += `${symbol} | ${p.price} | ${p.changePercent.toFixed(2)}% | ${p.high} | ${p.low} | ${p.open} | ${p.previousClose}\n`;
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
        max_tokens: 1500,
      }),
      perModelTimeout
    ),
    withTimeout(
      getQwenClient().chat.completions.create({
        model: "qwen-plus",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
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

  // Enrich suggestions in parallel with OHLC-based data (pattern + regime + confluence)
  const [scalpingEnrich, daytradingEnrich, swingEnrich] = await Promise.all([
    enrichSymbols(mergedScalping, "scalping"),
    enrichSymbols(mergedDaytrading, "daytrading"),
    enrichSymbols(mergedSwing, "swing"),
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
    marketsScanned: allSymbols.length,
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
