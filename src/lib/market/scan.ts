/**
 * Market scan logic — shared between the cron route and the suggestions API.
 * Scans 28 markets with DeepSeek + Qwen and returns a SuggestionsResponse.
 */
import { getPrices, getTimeSeries } from "@/lib/market/eodhd";
import { MARKETS, SCREENING_ROWS } from "@/lib/market/symbols";
import { marketScreeningPrompt, DISCLAIMER } from "@/lib/ai/prompts";
import type { MarketSuggestion, SuggestionRow, SuggestionsResponse } from "@/types/analysis";
import { detectAllPatterns } from "@/lib/candlestick-patterns";
import { calculateConfluenceScore } from "@/lib/confluence-score";
import { detectMarketRegime } from "@/lib/market-regime";
import { getATRAnalysis } from "@/lib/atr-calculator";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// AI clients
// ---------------------------------------------------------------------------

function getDeepSeekClient() {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    maxRetries: 0,
  });
}

function getQwenClient() {
  return new OpenAI({
    baseURL: "https://ws-cs1xxjuyessure89.eu-central-1.maas.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.QWEN_API_KEY || "",
    maxRetries: 0,
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

type OHLCBar = { datetime: string; open: number; high: number; low: number; close: number };
type BarsMap = Map<string, OHLCBar[]>;

interface IndicatorSummary {
  rsi: number;
  sma20: number | null;
  sma50: number | null;
  macd: "bullish" | "bearish" | "flat";
  bbPos: "near_upper" | "upper_half" | "mid" | "lower_half" | "near_lower";
}

interface EnrichmentData {
  candlestickPattern?: MarketSuggestion["candlestickPattern"];
  confluenceScore?: number;
  confluenceGrade?: "Excellent" | "Good" | "Moderate" | "Poor";
  marketRegime?: string;
  adx?: number;
  recommendation?: string;
}

// ---------------------------------------------------------------------------
// Market groups
// ---------------------------------------------------------------------------

export const ALL_MARKETS_BY_STYLE = {
  scalping: ["IXIC", "SPX", "XAU/USD", "DXY", "EUR/USD"],
  daytrading: ["GBP/USD", "USD/JPY", "CL", "EUR/JPY", "GBP/JPY", "AUD/JPY", "NZD/JPY", "CAD/JPY"],
  swing: [
    "XAG/USD", "AUD/USD", "USD/CAD", "NZD/USD", "USD/CHF",
    "EUR/GBP", "GBP/AUD", "GBP/NZD", "GBP/CAD", "GBP/CHF",
    "AUD/CAD", "AUD/CHF", "AUD/NZD", "EUR/AUD", "NZD/CAD",
  ],
} as const;

export const ALL_MARKETS_FLAT = [
  ...ALL_MARKETS_BY_STYLE.scalping,
  ...ALL_MARKETS_BY_STYLE.daytrading,
  ...ALL_MARKETS_BY_STYLE.swing,
];

const symbolToRow = new Map<string, keyof ParsedGroups>();
for (const [style, symbols] of Object.entries(ALL_MARKETS_BY_STYLE)) {
  for (const sym of symbols) symbolToRow.set(sym, style as keyof ParsedGroups);
}

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

function parseScreeningResponse(content: string): ParsedGroups {
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) content = codeBlockMatch[1].trim();
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        scalping: Array.isArray(parsed.scalping) ? parsed.scalping : [],
        daytrading: Array.isArray(parsed.daytrading) ? parsed.daytrading : [],
        swing: Array.isArray(parsed.swing) ? parsed.swing : [],
      };
    }
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

function mergeGroupSuggestions(a: RawSuggestion[], b: RawSuggestion[]): RawSuggestion[] {
  const scoreMap = new Map<string, RawSuggestion & { sources: number }>();
  for (const s of a) scoreMap.set(s.symbol, { ...s, sources: 1 });
  for (const s of b) {
    const existing = scoreMap.get(s.symbol);
    if (existing) {
      existing.confidence = Math.min(100, Math.round(((existing.confidence + s.confidence) / 2) * 1.15));
      existing.sentiment = Math.round((existing.sentiment + s.sentiment) / 2);
      existing.sources = 2;
      if (s.reasoning.length > existing.reasoning.length) existing.reasoning = s.reasoning;
    } else {
      scoreMap.set(s.symbol, { ...s, sources: 1 });
    }
  }
  return Array.from(scoreMap.values()).sort((a, b) => b.sources - a.sources || b.confidence - a.confidence);
}

// ---------------------------------------------------------------------------
// Indicator calculations
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// OHLC prefetch + enrichment
// ---------------------------------------------------------------------------

const STYLE_OHLC_TIMEFRAME: Record<string, string> = {
  scalping: "5min",
  daytrading: "1h",
  swing: "4h",
};

async function prefetchBarsForGroup(symbols: readonly string[], timeframe: string): Promise<BarsMap> {
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

function calculateSwingSR(bars: Array<{ high: number; low: number }>): { support: number[]; resistance: number[] } {
  const support: number[] = [];
  const resistance: number[] = [];
  for (let i = 2; i < bars.length - 2; i++) {
    if (bars[i].low < bars[i-1].low && bars[i].low < bars[i-2].low &&
        bars[i].low < bars[i+1].low && bars[i].low < bars[i+2].low) support.push(bars[i].low);
    if (bars[i].high > bars[i-1].high && bars[i].high > bars[i-2].high &&
        bars[i].high > bars[i+1].high && bars[i].high > bars[i+2].high) resistance.push(bars[i].high);
  }
  return { support: support.slice(-3), resistance: resistance.slice(0, 3) };
}

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
      } catch { /* best-effort */ }
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

// ---------------------------------------------------------------------------
// Main scan function — called by cron and (as fallback) by the GET handler
// ---------------------------------------------------------------------------

export async function runMarketScan(timeoutMs: number = 25_000): Promise<SuggestionsResponse> {
  const STYLE_LABELS: Record<string, { label: string; timeframe: string }> = {
    scalping:   { label: "SCALPING",      timeframe: "1m / 5m" },
    daytrading: { label: "DAY TRADING",   timeframe: "15m / 1H" },
    swing:      { label: "SWING TRADING", timeframe: "4H / Daily" },
  };

  // Fetch prices + OHLC bars for all 28 markets in parallel
  const [pricesArray, scalpingBars, daytradingBars, swingBars] = await Promise.all([
    getPrices([...ALL_MARKETS_FLAT]),
    prefetchBarsForGroup(ALL_MARKETS_BY_STYLE.scalping,   STYLE_OHLC_TIMEFRAME.scalping),
    prefetchBarsForGroup(ALL_MARKETS_BY_STYLE.daytrading, STYLE_OHLC_TIMEFRAME.daytrading),
    prefetchBarsForGroup(ALL_MARKETS_BY_STYLE.swing,      STYLE_OHLC_TIMEFRAME.swing),
  ]);

  const priceMap = new Map(pricesArray.map((p) => [p.symbol, p]));
  const allBars: Record<string, BarsMap> = { scalping: scalpingBars, daytrading: daytradingBars, swing: swingBars };

  // Build context for AI
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
        line += ` | RSI:${ind.rsi} | MACD:${ind.macd} | BB:${ind.bbPos}`;
        if (ind.sma20) line += ` | SMA20:${fmtPrice(ind.sma20)}`;
        if (ind.sma50) line += ` | SMA50:${fmtPrice(ind.sma50)}`;
      }
      context += line + `\n`;
    }
    context += `\n`;
  }

  const userMessage = `Screen these markets grouped by trading style. Analyze each group through its designated timeframe lens:\n\n${context}`;
  const systemMessage = marketScreeningPrompt();

  // Per-model timeout — both run in parallel so max wait = slower of the two
  // cron-job.org closes connection after 30s; EODHD takes ~8s → AI gets max 18s
  // max_tokens=800 keeps response time ~12s (15 suggestions × ~50 tokens each)
  const perModelTimeout = Math.min(timeoutMs - 5000, 18_000);

  const [deepseekRes, qwenRes] = await Promise.allSettled([
    withTimeout(
      getDeepSeekClient().chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
      perModelTimeout
    ),
    withTimeout(
      getQwenClient().chat.completions.create(
        {
          model: "qwen3.6-plus",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: 800,
          enable_thinking: false,
        } as OpenAI.ChatCompletionCreateParamsNonStreaming
      ),
      perModelTimeout
    ),
  ]);

  const deepseekError = deepseekRes.status === "rejected" ? deepseekRes.reason?.message : null;
  const qwenError     = qwenRes.status === "rejected"    ? qwenRes.reason?.message    : null;
  if (deepseekError) console.error("DeepSeek scan failed:", deepseekError);
  if (qwenError)     console.error("Qwen scan failed:", qwenError);

  const deepseekContent = deepseekRes.status === "fulfilled" ? (deepseekRes.value.choices[0]?.message?.content || "{}") : "{}";
  const qwenContent     = qwenRes.status     === "fulfilled" ? (qwenRes.value.choices[0]?.message?.content     || "{}") : "{}";

  // Log first 300 chars of each response to diagnose parse failures
  console.log("DeepSeek response:", deepseekContent.slice(0, 300));
  console.log("Qwen response:",     qwenContent.slice(0, 300));

  const deepseekGroups = parseScreeningResponse(deepseekContent);
  const qwenGroups     = parseScreeningResponse(qwenContent);

  const totalResults =
    deepseekGroups.scalping.length + deepseekGroups.daytrading.length + deepseekGroups.swing.length +
    qwenGroups.scalping.length + qwenGroups.daytrading.length + qwenGroups.swing.length;

  if (totalResults === 0) {
    const reason = [
      deepseekError ? `DeepSeek: ${deepseekError}` : `DeepSeek: parsed 0 results (raw: ${deepseekContent.slice(0, 100)})`,
      qwenError     ? `Qwen: ${qwenError}`         : `Qwen: parsed 0 results (raw: ${qwenContent.slice(0, 100)})`,
    ].join(" | ");
    throw new Error(`Both AI models returned no results — ${reason}`);
  }

  const mergedScalping   = mergeGroupSuggestions(deepseekGroups.scalping,   qwenGroups.scalping);
  const mergedDaytrading = mergeGroupSuggestions(deepseekGroups.daytrading, qwenGroups.daytrading);
  const mergedSwing      = mergeGroupSuggestions(deepseekGroups.swing,      qwenGroups.swing);

  const [scalpingEnrich, daytradingEnrich, swingEnrich] = await Promise.all([
    enrichSymbols(mergedScalping,   "scalping",   scalpingBars),
    enrichSymbols(mergedDaytrading, "daytrading", daytradingBars),
    enrichSymbols(mergedSwing,      "swing",      swingBars),
  ]);

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

  const now = new Date();
  return {
    rows,
    suggestions: rows.flatMap(r => r.suggestions),
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    disclaimer: DISCLAIMER,
    marketsScanned: ALL_MARKETS_FLAT.length,
  };
}
