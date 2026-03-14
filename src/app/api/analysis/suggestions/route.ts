import { NextRequest, NextResponse } from "next/server";
import { getPrices } from "@/lib/market/eodhd";
import { MARKETS } from "@/lib/market/symbols";
import { marketScreeningPrompt, DISCLAIMER } from "@/lib/ai/prompts";
import type { MarketSuggestion, SuggestionsResponse } from "@/types/analysis";
import OpenAI from "openai";

export const runtime = "edge";

const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes
const CACHE_KEY = "https://neuroquant.app/_internal/suggestions-cache";

// ---------------------------------------------------------------------------
// Shared cache helpers — all edge isolates see the same data
// ---------------------------------------------------------------------------

async function getCachedResult(): Promise<SuggestionsResponse | null> {
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
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });
    await cache.put(CACHE_KEY, response);
  } catch {
    // Silently fail — in-memory fallback below
  }
}

// In-memory fallback (per-isolate, used if Cache API unavailable)
let memoryCache: { data: SuggestionsResponse; expiresAt: number } | null = null;

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
// GET handler
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

  // Check shared cache first, then in-memory fallback
  const cached = await getCachedResult();
  if (cached) {
    return NextResponse.json({
      ...cached,
      suggestions: cached.suggestions.slice(0, maxSuggestions),
    });
  }

  if (memoryCache && memoryCache.expiresAt > Date.now()) {
    return NextResponse.json({
      ...memoryCache.data,
      suggestions: memoryCache.data.suggestions.slice(0, maxSuggestions),
    });
  }

  try {
    // Step 1: Fetch prices for all markets (single batch call — fast)
    const allSymbols = MARKETS.map((m) => m.symbol);
    const pricesArray = await getPrices(allSymbols);
    const priceMap = new Map(pricesArray.map((p) => [p.symbol, p]));

    // Step 2: Build compact screening context from price data only
    // (No indicator calls — avoids 25x API timeout on edge)
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

    // Step 3: Run DeepSeek + Qwen in parallel — dual AI screening
    // Wrap each call with a 30-second timeout to prevent 3+ minute waits
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI screening timeout after ${ms}ms`)), ms)
        ),
      ]);

    const AI_TIMEOUT = 30_000; // 30 seconds max per model

    const [deepseekRes, qwenRes] = await Promise.allSettled([
      withTimeout(
        getDeepSeekClient().chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: 1000,
        }),
        AI_TIMEOUT
      ),
      withTimeout(
        getQwenClient().chat.completions.create({
          model: "qwen3.5-plus",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: 1000,
        }),
        AI_TIMEOUT
      ),
    ]);

    const deepseekSuggestions = deepseekRes.status === "fulfilled"
      ? parseScreeningResponse(deepseekRes.value.choices[0]?.message?.content || "[]")
      : [];
    const qwenSuggestions = qwenRes.status === "fulfilled"
      ? parseScreeningResponse(qwenRes.value.choices[0]?.message?.content || "[]")
      : [];

    // Step 4: Merge — symbols flagged by both models get boosted confidence
    const scoreMap = new Map<string, RawSuggestion & { sources: number }>();

    for (const s of deepseekSuggestions) {
      scoreMap.set(s.symbol, { ...s, sources: 1 });
    }
    for (const s of qwenSuggestions) {
      const existing = scoreMap.get(s.symbol);
      if (existing) {
        // Both models agree — average scores and boost confidence by 15%
        existing.confidence = Math.min(100, Math.round((existing.confidence + s.confidence) / 2 * 1.15));
        existing.sentiment = Math.round((existing.sentiment + s.sentiment) / 2);
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
      .sort((a, b) => (b.sources - a.sources) || (b.confidence - a.confidence))
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

    const result: SuggestionsResponse = {
      suggestions,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      disclaimer: DISCLAIMER,
      marketsScanned: allSymbols.length,
    };

    // Store in both shared cache and in-memory fallback
    await setCachedResult(result);
    memoryCache = { data: result, expiresAt: expiresAt.getTime() };

    return NextResponse.json({
      ...result,
      suggestions: suggestions.slice(0, maxSuggestions),
    });
  } catch (error) {
    console.error("Suggestions API error:", error);
    return NextResponse.json(
      { error: "Suggestions temporarily unavailable" },
      { status: 503 }
    );
  }
}
