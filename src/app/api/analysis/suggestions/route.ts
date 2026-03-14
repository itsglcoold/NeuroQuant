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
const REVALIDATE_LOCK_KEY = "https://neuroquant.app/_internal/suggestions-revalidating";

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
        // Use stale TTL so the cache entry persists long enough for stale reads
        "Cache-Control": `public, max-age=${STALE_TTL_SECONDS}`,
      },
    });
    await cache.put(CACHE_KEY, response);
  } catch {
    // Silently fail — in-memory fallback below
  }
}

// Simple lock to prevent multiple simultaneous revalidations
async function isRevalidating(): Promise<boolean> {
  try {
    const cache = await caches.open("nq-suggestions");
    const lock = await cache.match(REVALIDATE_LOCK_KEY);
    return !!lock;
  } catch {
    return false;
  }
}

async function setRevalidating(active: boolean): Promise<void> {
  try {
    const cache = await caches.open("nq-suggestions");
    if (active) {
      // Lock expires after 90 seconds (safety net)
      await cache.put(
        REVALIDATE_LOCK_KEY,
        new Response("1", { headers: { "Cache-Control": "max-age=90" } })
      );
    } else {
      await cache.delete(REVALIDATE_LOCK_KEY);
    }
  } catch {
    // ignore
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
  // Strip markdown code blocks
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
// Core screening logic — used for both foreground and background scans
// ---------------------------------------------------------------------------

async function runScreening(): Promise<SuggestionsResponse> {
  // Step 1: Fetch prices for all markets (single batch call — fast)
  const allSymbols = MARKETS.map((m) => m.symbol);
  const pricesArray = await getPrices(allSymbols);
  const priceMap = new Map(pricesArray.map((p) => [p.symbol, p]));

  // Step 2: Build compact screening context from price data only
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

  // Step 3: Run DeepSeek + Qwen in parallel — full deep scan (no tight timeout)
  const [deepseekRes, qwenRes] = await Promise.allSettled([
    getDeepSeekClient().chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
    getQwenClient().chat.completions.create({
      model: "qwen3.5-plus",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
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

  // Step 4: Merge — symbols flagged by both models get boosted confidence
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

  // Sort: dual-model hits first, then by confidence
  const merged = Array.from(scoreMap.values())
    .sort((a, b) => b.sources - a.sources || b.confidence - a.confidence)
    .slice(0, 5);

  // Enrich with market metadata
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

  if (tier === "free") {
    return NextResponse.json(
      { error: "Pro subscription required", requiredTier: "pro" },
      { status: 403 }
    );
  }

  const maxSuggestions = tier === "premium" ? 5 : 3;

  // ---------------------------------------------------------------------------
  // 1. Try cache (shared Cache API, then in-memory fallback)
  // ---------------------------------------------------------------------------
  const cached = await getCachedResult();
  const cachedAt = cached?._cachedAt ?? 0;
  const ageMs = Date.now() - cachedAt;
  const isFresh = ageMs < CACHE_TTL_SECONDS * 1000;
  const isStale = !isFresh && ageMs < STALE_TTL_SECONDS * 1000;

  // Also check in-memory fallback
  const memCachedAt = memoryCache?.cachedAt ?? 0;
  const memAgeMs = Date.now() - memCachedAt;
  const memIsFresh = memAgeMs < CACHE_TTL_SECONDS * 1000;
  const memIsStale = !memIsFresh && memAgeMs < STALE_TTL_SECONDS * 1000;

  // Determine best available cached data
  const bestCached = cached ?? memoryCache?.data ?? null;
  const bestIsFresh = cached ? isFresh : memIsFresh;
  const bestIsStale = cached ? isStale : memIsStale;

  // ---------------------------------------------------------------------------
  // 2. FRESH cache → return immediately, no revalidation needed
  // ---------------------------------------------------------------------------
  if (bestCached && bestIsFresh) {
    return NextResponse.json({
      ...bestCached,
      suggestions: bestCached.suggestions.slice(0, maxSuggestions),
      _stale: false,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. STALE cache → return immediately + trigger background revalidation
  // ---------------------------------------------------------------------------
  if (bestCached && bestIsStale) {
    // Kick off background revalidation (fire-and-forget on edge via waitUntil)
    const alreadyRevalidating = await isRevalidating();
    if (!alreadyRevalidating) {
      // Use waitUntil if available (Cloudflare Workers / Edge), otherwise fire-and-forget
      const ctx = (request as unknown as { waitUntil?: (p: Promise<unknown>) => void });
      const revalidatePromise = (async () => {
        await setRevalidating(true);
        try {
          const fresh = await runScreening();
          await setCachedResult(fresh);
          memoryCache = { data: fresh, cachedAt: Date.now() };
        } catch (err) {
          console.error("Background revalidation failed:", err);
        } finally {
          await setRevalidating(false);
        }
      })();

      if (ctx.waitUntil) {
        ctx.waitUntil(revalidatePromise);
      }
      // If no waitUntil, the promise runs but may be killed on edge — acceptable tradeoff
    }

    return NextResponse.json({
      ...bestCached,
      suggestions: bestCached.suggestions.slice(0, maxSuggestions),
      _stale: true,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. NO cache at all → first-time load, must wait (with 45s safety timeout)
  // ---------------------------------------------------------------------------
  try {
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`AI screening timeout after ${ms}ms`)),
            ms
          )
        ),
      ]);

    const result = await withTimeout(runScreening(), 45_000);

    // Store in both caches
    await setCachedResult(result);
    memoryCache = { data: result, cachedAt: Date.now() };

    return NextResponse.json({
      ...result,
      suggestions: result.suggestions.slice(0, maxSuggestions),
      _stale: false,
    });
  } catch (error) {
    console.error("Suggestions API error:", error);
    return NextResponse.json(
      { error: "Suggestions temporarily unavailable" },
      { status: 503 }
    );
  }
}
