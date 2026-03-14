import { NextRequest, NextResponse } from "next/server";
import { getPrices } from "@/lib/market/eodhd";
import { MARKETS } from "@/lib/market/symbols";
import { marketScreeningPrompt, DISCLAIMER } from "@/lib/ai/prompts";
import type { MarketSuggestion, SuggestionsResponse } from "@/types/analysis";
import OpenAI from "openai";

export const runtime = "edge";

const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes — fresh window
const STALE_TTL_SECONDS = 4 * 60 * 60; // 4 hours — serve stale up to this age
const CACHE_KEY = "https://neuroquant.app/_internal/suggestions-cache";

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

function parseScreeningResponse(content: string): RawSuggestion[] {
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) content = codeBlockMatch[1].trim();

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

async function runScreening(timeoutMs: number = 90_000): Promise<SuggestionsResponse> {
  const allSymbols = MARKETS.map((m) => m.symbol);
  const pricesArray = await getPrices(allSymbols);
  const priceMap = new Map(pricesArray.map((p) => [p.symbol, p]));

  let context = `MARKET SCREENING DATA (${allSymbols.length} markets):\n`;
  context += `Symbol | Price | Change% | High | Low | Open | PrevClose\n`;
  context += `${"—".repeat(70)}\n`;

  for (const symbol of allSymbols) {
    const p = priceMap.get(symbol);
    if (!p || p.price === 0) continue;
    context += `${symbol} | ${p.price} | ${p.changePercent.toFixed(2)}% | ${p.high} | ${p.low} | ${p.open} | ${p.previousClose}\n`;
  }

  const userMessage = `Screen these markets based on price action, momentum, and intraday range. Return the top 5 with the strongest signals:\n\n${context}`;
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
      getQwenClient().chat.completions.create({
        model: "qwen3.5-plus",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
      perModelTimeout
    ),
  ]);

  const deepseekSuggestions =
    deepseekRes.status === "fulfilled"
      ? parseScreeningResponse(
          deepseekRes.value.choices[0]?.message?.content || "[]"
        )
      : [];
  const qwenSuggestions =
    qwenRes.status === "fulfilled"
      ? parseScreeningResponse(
          qwenRes.value.choices[0]?.message?.content || "[]"
        )
      : [];

  // If both models failed, throw so caller knows
  if (deepseekSuggestions.length === 0 && qwenSuggestions.length === 0) {
    throw new Error("Both AI models returned no results");
  }

  // Merge — symbols flagged by both models get boosted confidence
  const scoreMap = new Map<string, RawSuggestion & { sources: number }>();

  for (const s of deepseekSuggestions) {
    scoreMap.set(s.symbol, { ...s, sources: 1 });
  }
  for (const s of qwenSuggestions) {
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

  const merged = Array.from(scoreMap.values())
    .sort((a, b) => b.sources - a.sources || b.confidence - a.confidence)
    .slice(0, 5);

  const suggestions: MarketSuggestion[] = merged.map((raw) => {
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
    };
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_SECONDS * 1000);

  return {
    suggestions,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    disclaimer: DISCLAIMER,
    marketsScanned: allSymbols.length,
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

  const maxSuggestions = tier === "premium" ? 5 : 3;

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
      ...bestCached,
      suggestions: bestCached.suggestions.slice(0, maxSuggestions),
      _stale: false,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. STALE but usable cache → return stale data immediately
  //    The frontend auto-refreshes every 5 min, which will trigger a fresh scan
  // ---------------------------------------------------------------------------
  if (bestCached && bestIsUsable) {
    return NextResponse.json({
      ...bestCached,
      suggestions: bestCached.suggestions.slice(0, maxSuggestions),
      _stale: true,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. NO usable cache → must scan now (first load or cache fully expired)
  // ---------------------------------------------------------------------------
  try {
    const result = await runScreening(90_000);

    await setCachedResult(result);
    memoryCache = { data: result, cachedAt: Date.now() };

    return NextResponse.json({
      ...result,
      suggestions: result.suggestions.slice(0, maxSuggestions),
      _stale: false,
    });
  } catch (error) {
    // If scan fails but we have ANY old cached data, return it rather than error
    if (bestCached) {
      return NextResponse.json({
        ...bestCached,
        suggestions: bestCached.suggestions.slice(0, maxSuggestions),
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
