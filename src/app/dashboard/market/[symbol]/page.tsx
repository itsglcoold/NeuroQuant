"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TradingViewChart } from "@/components/dashboard/TradingViewChart";
import { MarketSwitcher } from "@/components/dashboard/MarketSwitcher";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import { getMarketBySymbol, getMarketEmoji, CATEGORY_COLORS, getSymbolTradingStyle } from "@/lib/market/symbols";
import { cn } from "@/lib/utils";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { ConsensusResult } from "@/types/analysis";
import { MarketPrice, TechnicalIndicators } from "@/types/market";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Cpu,
  Eye,
  Globe2,
  Lock,
  Crown,
  Sparkles,
  Shield,
  Clock,
  Activity,
  X,
  Trash2,
} from "lucide-react";
import type { ModelOutput } from "@/types/analysis";
import { QuickSimWidget } from "@/components/simulator/QuickSimWidget";
import { SimulatorOnboarding } from "@/components/simulator/SimulatorOnboarding";
import { useSimulator } from "@/hooks/useSimulator";

export const runtime = 'edge';

// Interval mapping: display label → API value → TradingView value
interface IntervalOption {
  label: string;
  api: string;
  tv: string;
}

const INTERVALS: IntervalOption[] = [
  { label: "1m", api: "1min", tv: "1" },
  { label: "5m", api: "5min", tv: "5" },
  { label: "15m", api: "15min", tv: "15" },
  { label: "1H", api: "1h", tv: "60" },
  { label: "4H", api: "4h", tv: "240" },
  { label: "1D", api: "1day", tv: "D" },
];

// ---------------------------------------------------------------------------
// External links per symbol
// ---------------------------------------------------------------------------

const FOREX_FACTORY_LINKS: Record<string, string> = {
  "XAU/USD": "https://www.forexfactory.com/market/goldusd",
  "XAG/USD": "https://www.forexfactory.com/market/silverusd",
  "EUR/USD": "https://www.forexfactory.com/market/eurusd",
  "GBP/USD": "https://www.forexfactory.com/market/gbpusd",
  "USD/JPY": "https://www.forexfactory.com/market/usdjpy",
  "USD/CHF": "https://www.forexfactory.com/market/usdchf",
  "AUD/USD": "https://www.forexfactory.com/market/audusd",
  "NZD/USD": "https://www.forexfactory.com/market/nzdusd",
  "USD/CAD": "https://www.forexfactory.com/market/usdcad",
  "EUR/JPY": "https://www.forexfactory.com/market/eurjpy",
  "GBP/JPY": "https://www.forexfactory.com/market/gbpjpy",
  "AUD/JPY": "https://www.forexfactory.com/market/audjpy",
  "NZD/JPY": "https://www.forexfactory.com/market/nzdjpy",
  "CAD/JPY": "https://www.forexfactory.com/market/cadjpy",
  "EUR/GBP": "https://www.forexfactory.com/market/eurgbp",
  "GBP/AUD": "https://www.forexfactory.com/market/gbpaud",
  "GBP/NZD": "https://www.forexfactory.com/market/gbpnzd",
  "GBP/CAD": "https://www.forexfactory.com/market/gbpcad",
  "GBP/CHF": "https://www.forexfactory.com/market/gbpchf",
  "AUD/CAD": "https://www.forexfactory.com/market/audcad",
  "AUD/CHF": "https://www.forexfactory.com/market/audchf",
  "AUD/NZD": "https://www.forexfactory.com/market/audnzd",
  "EUR/AUD": "https://www.forexfactory.com/market/euraud",
  "NZD/CAD": "https://www.forexfactory.com/market/nzdcad",
};

const INVESTING_LINKS: Record<string, string> = {
  "XAU/USD": "https://www.investing.com/commodities/gold",
  "XAG/USD": "https://www.investing.com/commodities/silver",
  "CL": "https://www.investing.com/commodities/crude-oil",
  "EUR/USD": "https://www.investing.com/currencies/eur-usd",
  "GBP/USD": "https://www.investing.com/currencies/gbp-usd",
  "USD/JPY": "https://www.investing.com/currencies/usd-jpy",
  "USD/CHF": "https://www.investing.com/currencies/usd-chf",
  "AUD/USD": "https://www.investing.com/currencies/aud-usd",
  "NZD/USD": "https://www.investing.com/currencies/nzd-usd",
  "USD/CAD": "https://www.investing.com/currencies/usd-cad",
  "EUR/JPY": "https://www.investing.com/currencies/eur-jpy",
  "GBP/JPY": "https://www.investing.com/currencies/gbp-jpy",
  "AUD/JPY": "https://www.investing.com/currencies/aud-jpy",
  "NZD/JPY": "https://www.investing.com/currencies/nzd-jpy",
  "CAD/JPY": "https://www.investing.com/currencies/cad-jpy",
  "EUR/GBP": "https://www.investing.com/currencies/eur-gbp",
  "GBP/AUD": "https://www.investing.com/currencies/gbp-aud",
  "GBP/NZD": "https://www.investing.com/currencies/gbp-nzd",
  "GBP/CAD": "https://www.investing.com/currencies/gbp-cad",
  "GBP/CHF": "https://www.investing.com/currencies/gbp-chf",
  "AUD/CAD": "https://www.investing.com/currencies/aud-cad",
  "AUD/CHF": "https://www.investing.com/currencies/aud-chf",
  "AUD/NZD": "https://www.investing.com/currencies/aud-nzd",
  "EUR/AUD": "https://www.investing.com/currencies/eur-aud",
  "NZD/CAD": "https://www.investing.com/currencies/nzd-cad",
  "DXY": "https://www.investing.com/indices/usdollar",
  "SPX": "https://www.investing.com/indices/us-spx-500",
  "IXIC": "https://www.investing.com/indices/nasdaq-composite",
};

function formatPrice(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "\u2014";
  return value.toFixed(decimals);
}

function getCurrencyPrefix(symbol: string): string {
  // Metals, energy, indices — all priced in USD
  if (["XAU/USD", "XAG/USD", "CL", "SPX", "IXIC", "DXY"].includes(symbol)) return "$";
  // Forex pairs: show symbol of the QUOTE currency (right side of pair)
  if (symbol.includes("/")) {
    const quote = symbol.split("/")[1];
    if (quote === "USD") return "$";
    if (quote === "GBP") return "£";
    if (quote === "JPY") return "¥";
    if (quote === "CHF") return "Fr ";
    if (quote === "CAD") return "C$";
    if (quote === "AUD") return "A$";
    if (quote === "NZD") return "NZ$";
    return "";
  }
  return "$";
}

function getPriceDecimals(price: number | null | undefined): number {
  if (price === null || price === undefined || isNaN(price)) return 2;
  return price > 100 ? 2 : 4;
}

// Map trading style to a sensible default interval
const STYLE_DEFAULT_INTERVAL: Record<string, number> = {
  scalping: 1,   // 5m
  daytrading: 3, // 1H
  swing: 5,      // 1D
};

export default function MarketDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const symbol = decodeURIComponent(params.symbol as string);
  const market = getMarketBySymbol(symbol);
  const tradingStyle = searchParams.get("style") || undefined; // scalping | daytrading | swing

  const [price, setPrice] = useState<MarketPrice | null>(null);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [streamedAnalysts, setStreamedAnalysts] = useState<ModelOutput[]>([]);
  const [analystFailures, setAnalystFailures] = useState(0);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState(
    INTERVALS[tradingStyle ? (STYLE_DEFAULT_INTERVAL[tradingStyle] ?? 5) : 5]
  ); // Default based on trading style
  const { canRunAnalysis, consumeAnalysis, analysesRemaining, analysesTotal, tier } = useUsageTracking();
  const simulator = useSimulator(tier);

  const fetchMarketData = useCallback(async () => {
    setLoading(true);
    try {
      const [quoteRes, indicatorsRes] = await Promise.all([
        fetch(`/api/market-data?symbol=${encodeURIComponent(symbol)}&type=quote`),
        fetch(`/api/market-data?symbol=${encodeURIComponent(symbol)}&type=indicators`),
      ]);

      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        setPrice(quoteData.data);
      }
      if (indicatorsRes.ok) {
        const indData = await indicatorsRes.json();
        setIndicators(indData.data);
      }
    } catch (error) {
      console.error("Failed to fetch market data:", error);
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  async function runAnalysis(intervalOverride?: string) {
    if (!canRunAnalysis) {
      setShowUpgradeModal(true);
      return;
    }

    setAnalyzing(true);
    setAnalysisStatus("Starting analysis…");
    setAnalysisError(null);
    setStreamedAnalysts([]);
    setConsensus(null);
    setAnalystFailures(0);
    consumeAnalysis();

    const apiInterval = intervalOverride || selectedInterval.api;

    try {
      const res = await fetch("/api/analysis/technical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, tier, interval: apiInterval, tradingStyle }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Analysis request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (!match) continue;

          try {
            const { event, data } = JSON.parse(match[1]);

            if (event === "status") {
              setAnalysisStatus(data.message);
            } else if (event === "market_data") {
              if (data.price) setPrice(data.price);
              if (data.indicators) setIndicators(data.indicators);
            } else if (event === "analyst") {
              setStreamedAnalysts((prev) => {
                const next = [...prev];
                next[data.index] = data.result;
                return next;
              });
              if (data.failed) {
                setAnalystFailures((prev) => prev + 1);
                setAnalysisStatus(`⚠ ${data.result.model} failed — retrying next time`);
              } else {
                setAnalysisStatus(`${data.result.model} done — ${data.result.direction} (${data.result.confidence}%)`);
              }
            } else if (event === "analysts_complete") {
              if (data.failed > 0) {
                setAnalysisStatus(`⚠ ${data.success}/${data.total} analysts completed — ${data.failed} failed`);
              }
            } else if (event === "consensus") {
              setConsensus(data.consensus);
              if (data.price) setPrice(data.price);
              if (data.indicators) setIndicators(data.indicators);
            } else if (event === "error") {
              setAnalysisError(data.message || "Analysis failed. Please try again.");
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Analysis failed. Please try again.");
    }
    setAnalyzing(false);
    setAnalysisStatus("");
  }

  const directionIcon = {
    bullish: <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />,
    bearish: <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />,
    neutral: <Minus className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
  };

  const directionColor = {
    bullish: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    bearish: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    neutral: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };

  const decimals = getPriceDecimals(price?.price);
  const prefix = getCurrencyPrefix(symbol);

  return (
    <div className="space-y-4">
      {/* Market Switcher */}
      <MarketSwitcher currentSymbol={symbol} />

      {/* Header: Name + Price */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {market && (
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                CATEGORY_COLORS[market.category].bg
              }`}
            >
              <span className="text-xl">{getMarketEmoji(symbol)}</span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold leading-tight">
                {market?.name || symbol}
              </h1>
              {(() => {
                const style = getSymbolTradingStyle(symbol);
                if (!style) return null;
                const colors: Record<string, string> = {
                  scalping: "bg-red-500/10 text-red-500 border-red-500/20",
                  daytrading: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                  swing: "bg-amber-500/10 text-amber-500 border-amber-500/20",
                };
                return (
                  <Badge className={`${colors[style.key] || ""} border text-xs font-semibold px-2.5 py-0.5`}>
                    {style.label} · {style.timeframeFocus}
                  </Badge>
                );
              })()}
            </div>
            <p className="text-xs text-muted-foreground">{symbol}</p>
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          {loading ? (
            <Skeleton className="h-8 w-32" />
          ) : price ? (
            <>
              <span className="text-2xl font-bold tabular-nums">
                {prefix}
                {formatPrice(price.price, decimals)}
              </span>
              <span
                className={`text-sm font-semibold ${
                  (price.change ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {(price.change ?? 0) >= 0 ? "+" : ""}
                {formatPrice(price.change, decimals)} (
                {(price.changePercent ?? 0) >= 0 ? "+" : ""}
                {formatPrice(price.changePercent)}%)
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Price unavailable</span>
          )}
          <Button onClick={fetchMarketData} variant="ghost" size="icon" className="h-8 w-8">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Chart — full width */}
      <TradingViewChart symbol={symbol} height={500} interval={selectedInterval.tv} />

      {/* Interval Selector + Run Analysis */}
      <div className="flex flex-col gap-3">
        {/* Interval pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Timeframe:
          </div>
          <div className="flex gap-1">
            {INTERVALS.map((iv) => (
              <button
                key={iv.api}
                onClick={() => setSelectedInterval(iv)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  selectedInterval.api === iv.api
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Button
          onClick={() => runAnalysis()}
          disabled={analyzing}
          className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/20 h-11 text-sm font-semibold"
        >
          {analyzing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              {analysisStatus || "Analyzing…"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Run AI Analysis
            </>
          )}
        </Button>

        {/* Usage meter (inline on desktop) */}
        {tier === "free" && analysesTotal !== Infinity && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
              {analysesRemaining}/{analysesTotal}
            </span>
            <div className="h-1.5 w-20 bg-amber-500/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                style={{ width: `${((analysesTotal - analysesRemaining) / analysesTotal) * 100}%` }}
              />
            </div>
            <Link href="/pricing" className="text-[10px] text-blue-500 hover:underline font-medium whitespace-nowrap">
              Upgrade
            </Link>
          </div>
        )}
      </div>
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="ai-analysis"
        requiredTier="pro"
        reason="limit-reached"
      />

      {/* Analysis error banner */}
      {analysisError && !analyzing && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>{analysisError}</span>
        </div>
      )}

      {/* Analysis results: Analysts (left) + Consensus (right) */}
      {(() => {
        const analyses = consensus?.individualAnalyses || streamedAnalysts.filter(Boolean);
        const hasAnalysis = analyses.length > 0 || consensus;

        if (!hasAnalysis) {
          // No analysis yet — centered full-width placeholder
          return (
            <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 backdrop-blur-sm p-8 text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Click &quot;Run AI Analysis&quot; for{" "}
                {tier === "free" ? "single-analyst" : "triple-AI consensus"}{" "}
                insights.
              </p>
              {tier === "free" && (
                <div className="mt-4 rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 max-w-sm mx-auto space-y-2">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    <span className="font-medium">Free plan: 1 AI analyst</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Unlock the full Triple-AI Consensus Engine with Analyst Alpha, Beta &amp; Gamma for higher accuracy.
                  </p>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    <Crown className="h-3 w-3" />
                    Upgrade to Pro
                  </Link>
                </div>
              )}
            </div>
          );
        }

        // Analysis available — two-column layout
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Analyst Tabs — left 2/3 */}
            <div className="lg:col-span-2 space-y-4">
              {/* Warning if analysts failed */}
              {analystFailures > 0 && !analyzing && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                  <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-amber-600 dark:text-amber-400">
                    {analystFailures === 1
                      ? "1 analyst timed out — consensus is based on 2 analysts. Try again for full accuracy."
                      : `${analystFailures} analysts timed out — results may be less accurate. Try again.`}
                  </span>
                  <button
                    onClick={() => runAnalysis()}
                    className="ml-auto shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}
              {analyses.length > 0 && (
                <AnalystTabs
                  analyses={analyses}
                  directionIcon={directionIcon}
                  directionColor={directionColor}
                  tier={tier}
                />
              )}

              {/* Compliance badge + Disclaimer */}
              {consensus && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-1.5 rounded-lg bg-muted/40 py-1.5">
                    <Shield className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[9px] font-medium text-muted-foreground/60 tracking-wide uppercase">
                      NeuroQuant Institutional Analytics — For Educational Use Only
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed text-center">
                    {consensus.disclaimer}
                  </p>
                </div>
              )}
            </div>

            {/* AI Consensus — right 1/3 */}
            {consensus && (
              <div className="lg:col-span-1">
                <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-md p-3 space-y-3 shadow-sm lg:sticky lg:top-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">AI Consensus</h3>
                        <p className="text-[10px] text-muted-foreground">
                          {consensus.individualAnalyses.length} analyst{consensus.individualAnalyses.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${directionColor[consensus.consensusDirection]} text-xs font-bold`}>
                      {consensus.consensusDirection.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Consensus Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-medium">
                      <span className="text-red-500 dark:text-red-400">Bearish</span>
                      <span className="text-xs font-bold text-foreground">
                        Score: {consensus.consensusScore > 0 ? "+" : ""}{consensus.consensusScore}
                      </span>
                      <span className="text-green-500 dark:text-green-400">Bullish</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden relative shadow-inner">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-amber-400 to-green-500 opacity-25" />
                      <div
                        className="absolute top-0 bottom-0 w-2.5 bg-foreground rounded-full shadow-md transition-all duration-700 -translate-x-1/2"
                        style={{
                          left: `${Math.max(4, Math.min(96, ((consensus.consensusScore + 100) / 200) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xs font-bold ${
                        consensus.consensusScore > 20 ? "text-green-500" :
                        consensus.consensusScore < -20 ? "text-red-500" : "text-amber-500"
                      }`}>
                        {consensus.sentimentLabel || `${consensus.agreementLevel} agreement`}
                      </span>
                      {consensus.probabilityScore !== undefined && (
                        <span className="text-xs text-foreground/70">
                          Probability Alignment: <span className="font-bold text-foreground">{consensus.probabilityScore}%</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Key Levels */}
                  {(consensus.mergedKeyLevels.support.length > 0 ||
                    consensus.mergedKeyLevels.resistance.length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-green-500/5 border border-green-500/15 p-2.5">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 mb-1.5">
                          Support
                        </h4>
                        {consensus.mergedKeyLevels.support.slice(0, 3).map((level, i) => (
                          <p key={i} className="text-xs tabular-nums text-foreground/80 font-medium">
                            {prefix}{formatPrice(level, decimals)}
                          </p>
                        ))}
                      </div>
                      <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-2.5">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1.5">
                          Resistance
                        </h4>
                        {consensus.mergedKeyLevels.resistance.slice(0, 3).map((level, i) => (
                          <p key={i} className="text-xs tabular-nums text-foreground/80 font-medium">
                            {prefix}{formatPrice(level, decimals)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="text-xs text-foreground/80 leading-relaxed space-y-1">
                    {(consensus.summary || "").split("\n").map((line, i) => {
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <p key={i}>
                          {parts.map((part, j) =>
                            part.startsWith("**") && part.endsWith("**") ? (
                              <strong key={j} className="font-bold text-foreground">{part.slice(2, -2)}</strong>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Active trades for this symbol */}
      {(() => {
        const symbolTrades = simulator.openTrades.filter((t) => t.symbol === symbol);
        if (symbolTrades.length === 0) return null;
        const currentPrice = price?.price ?? null;

        function calcPnl(trade: typeof symbolTrades[0], cp: number) {
          return trade.side === "long"
            ? ((cp - trade.entry_price) / trade.entry_price) * 100
            : ((trade.entry_price - cp) / trade.entry_price) * 100;
        }
        function fmt(p: number) {
          return p > 100 ? p.toFixed(2) : p.toFixed(4);
        }

        return (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              Active Trades — {symbol}
            </h3>
            {symbolTrades.map((trade) => {
              const pnl = currentPrice ? calcPnl(trade, currentPrice) : null;
              const isWinning = pnl !== null && pnl >= 0;
              return (
                <div
                  key={trade.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        trade.side === "long"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                          : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                      }
                    >
                      {trade.side === "long" ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {trade.side === "long" ? "BULLISH" : "BEARISH"}
                    </Badge>
                    <div className="flex gap-4 text-xs tabular-nums">
                      <span className="text-muted-foreground">Entry <span className="text-foreground font-medium">{fmt(trade.entry_price)}</span></span>
                      <span className="text-red-500">SL <span className="font-medium">{fmt(trade.sl_price)}</span></span>
                      <span className="text-green-500">TP <span className="font-medium">{fmt(trade.tp_price)}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {pnl !== null && (
                      <span className={`text-sm font-bold tabular-nums ${isWinning ? "text-green-500" : "text-red-500"}`}>
                        {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!currentPrice}
                      onClick={async () => {
                        if (currentPrice) {
                          await simulator.closeTrade(trade.id, currentPrice);
                          simulator.refetch();
                        }
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Close
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={async () => {
                        if (confirm("Delete this trade?")) {
                          await simulator.deleteTrade(trade.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Quick Simulator Widget */}
      {consensus && price && (
        <>
          <QuickSimWidget
            symbol={symbol}
            currentPrice={price.price}
            consensus={consensus}
            tier={tier}
            canOpenTrade={simulator.canOpenTrade}
            tradesRemaining={simulator.tradesRemaining}
            dailyLimit={simulator.dailyLimit}
            onOpenTrade={simulator.openTrade}
            decimals={decimals}
            prefix={prefix}
            analysisTimeframe={consensus.timeframe}
            onSwitchTimeframe={(newApi) => {
              const iv = INTERVALS.find((i) => i.api === newApi);
              if (iv) {
                setSelectedInterval(iv);
                runAnalysis(newApi);
              }
            }}
          />
          <SimulatorOnboarding />
        </>
      )}

      {/* OHLC Price Bar */}
      {price && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Open", value: price.open, bg: "bg-blue-50 border-blue-200 dark:bg-blue-500/15 dark:border-blue-400/30", labelColor: "text-blue-600 dark:text-blue-400" },
            { label: "High", value: price.high, bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/15 dark:border-emerald-400/30", labelColor: "text-emerald-600 dark:text-emerald-400" },
            { label: "Low", value: price.low, bg: "bg-red-50 border-red-200 dark:bg-red-500/15 dark:border-red-400/30", labelColor: "text-red-600 dark:text-red-400" },
            { label: "Prev Close", value: price.previousClose, bg: "bg-amber-50 border-amber-200 dark:bg-amber-500/15 dark:border-amber-400/30", labelColor: "text-amber-600 dark:text-amber-400" },
          ].map((item) => (
            <Card key={item.label} className={`border ${item.bg}`}>
              <CardContent className="py-3 px-4">
                <span className={`block text-[11px] font-semibold uppercase tracking-wider ${item.labelColor}`}>
                  {item.label}
                </span>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {item.value && item.value > 0
                    ? `${prefix}${formatPrice(item.value, decimals)}`
                    : "—"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* External Links */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(`${market?.name || symbol} price today live`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#dadce0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-[#3c4043] dark:text-zinc-200 hover:shadow-sm transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Google
        </a>
        {INVESTING_LINKS[symbol] && (
          <a
            href={INVESTING_LINKS[symbol]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#e07020]/30 bg-[#fff8f0] dark:bg-[#2a1f10] px-3 py-1.5 text-xs font-medium text-[#d4611e] dark:text-[#f0943a] hover:shadow-sm transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="#e07020"/>
              <text x="12" y="16.5" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white" fontFamily="Arial">i</text>
            </svg>
            Investing.com
          </a>
        )}
        {FOREX_FACTORY_LINKS[symbol] && (
          <a
            href={FOREX_FACTORY_LINKS[symbol]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#3b82c4]/30 bg-[#f0f6ff] dark:bg-[#0f1a2a] px-3 py-1.5 text-xs font-medium text-[#2a6db5] dark:text-[#5da3e8] hover:shadow-sm transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="1" width="22" height="22" rx="4" fill="#2a6db5"/>
              <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill="white" fontFamily="Arial">FF</text>
            </svg>
            Forex Factory
          </a>
        )}
      </div>

      {/* Technical Indicators (collapsible) */}
      <button
        onClick={() => setShowIndicators(!showIndicators)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {showIndicators ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        Technical Indicators
      </button>

      {showIndicators && (
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : indicators ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <IndicatorRow
                  label="RSI (14)"
                  value={formatPrice(indicators.rsi, 2)}
                  signal={
                    indicators.rsi
                      ? indicators.rsi > 70
                        ? "Overbought"
                        : indicators.rsi < 30
                          ? "Oversold"
                          : "Neutral"
                      : undefined
                  }
                />
                <IndicatorRow label="SMA (20)" value={formatPrice(indicators.sma20, decimals)} />
                <IndicatorRow label="SMA (50)" value={formatPrice(indicators.sma50, decimals)} />
                <IndicatorRow
                  label="MACD"
                  value={formatPrice(indicators.macd?.macd, 4)}
                  signal={
                    indicators.macd
                      ? indicators.macd.histogram > 0
                        ? "Bullish"
                        : "Bearish"
                      : undefined
                  }
                />
                <IndicatorRow
                  label="BB Upper"
                  value={formatPrice(indicators.bollingerBands?.upper, decimals)}
                />
                <IndicatorRow
                  label="BB Lower"
                  value={formatPrice(indicators.bollingerBands?.lower, decimals)}
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Indicators unavailable</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function IndicatorRow({
  label,
  value,
  signal,
}: {
  label: string;
  value: string;
  signal?: string;
}) {
  const signalStyle =
    signal === "Bullish" || signal === "Oversold"
      ? "text-green-600 dark:text-green-400 bg-green-500/10"
      : signal === "Bearish" || signal === "Overbought"
        ? "text-red-600 dark:text-red-400 bg-red-500/10"
        : "text-amber-600 dark:text-amber-400 bg-amber-500/10";

  return (
    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
      <span className="text-xs text-foreground/80">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono tabular-nums">{value}</span>
        {signal && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${signalStyle}`}>{signal}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Format reasoning text — bold section headers, separate paragraphs
// ---------------------------------------------------------------------------

function formatReasoning(text: string): React.ReactNode[] {
  if (!text) return [];

  // Split on known section markers
  const sectionPattern = /(📊\s*(?:Intraday\/Scalp Outlook|Scalp\/Intraday Outlook|Scalp Outlook[^:]*|Intraday Setup[^:]*)[:\s]*|📈\s*(?:Swing\/Daily Outlook|Swing\/Position Outlook|Swing Outlook[^:]*|Short-Term Context[^:]*)[:\s]*|(?:Overall Assessment|In summary|Conclusion)[:\s]*)/gi;

  const parts = text.split(sectionPattern).filter(Boolean);

  return parts.map((part, i) => {
    const isHeader = sectionPattern.test(part);
    // Reset lastIndex after test (regex with /g flag)
    sectionPattern.lastIndex = 0;

    if (isHeader) {
      return (
        <h4 key={i} className="font-bold text-foreground mt-1">
          {part.trim()}
        </h4>
      );
    }
    return (
      <p key={i} className="text-foreground/80">
        {part.trim()}
      </p>
    );
  });
}

// ---------------------------------------------------------------------------
// Tabbed Analyst Interface — replaces stacked accordion cards
// ---------------------------------------------------------------------------

const ANALYST_META: Record<string, { icon: typeof Cpu; label: string; subtitle: string; description: string; color: string; bg: string; border: string; dot: string }> = {
  "Analyst Alpha": { icon: Cpu, label: "Quantitative Engine · 40%", subtitle: "Quantitative Engine", description: "Processes thousands of data points — from RSI and moving averages to Fibonacci retracements — searching for statistical patterns invisible to the human eye.", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-500" },
  "Analyst Beta":  { icon: Eye, label: "Pattern Recognition · 40%", subtitle: "Pattern Recognition", description: "Identifies chart formations like head-and-shoulders, flags, and support zones — exactly like a seasoned trader, but at the speed of light.", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/30", dot: "bg-purple-500" },
  "Analyst Gamma": { icon: Globe2, label: "Strategic Context · 20%", subtitle: "Strategic Context", description: "Goes beyond price — integrating technical signals with macro-economic trends, central bank policy, and cross-market correlations for a deeper perspective.", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-500" },
};
const FALLBACK_META = { icon: Cpu, label: "Analysis", subtitle: "Analysis", description: "", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-500" };

function AnalystTabs({
  analyses,
  directionIcon,
  directionColor,
  tier,
}: {
  analyses: ModelOutput[];
  directionIcon: Record<string, React.ReactNode>;
  directionColor: Record<string, string>;
  tier: string;
}) {
  const [activeTab, setActiveTab] = useState(0);

  // All 3 possible analysts (for locked state on free tier)
  const allSlots = ["Analyst Alpha", "Analyst Beta", "Analyst Gamma"];
  const analysisMap = new Map(analyses.map((a) => [a.model, a]));

  const activeAnalysis = analyses[activeTab] || analyses[0];
  const activeMeta = activeAnalysis ? (ANALYST_META[activeAnalysis.model] || FALLBACK_META) : FALLBACK_META;

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-md overflow-hidden shadow-sm">
      {/* Tab bar */}
      <div className="flex border-b border-border/40">
        {tier === "free" ? (
          // Free tier: show all 3 slots, Beta/Gamma locked
          allSlots.map((slotName, i) => {
            const meta = ANALYST_META[slotName] || FALLBACK_META;
            const analysis = analysisMap.get(slotName);
            const isLocked = i > 0;
            const isActive = activeTab === i && !isLocked;

            return (
              <button
                key={slotName}
                onClick={() => !isLocked && analysis && setActiveTab(i)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-medium transition-all relative",
                  isActive
                    ? "text-foreground"
                    : isLocked
                      ? "text-muted-foreground/50 cursor-not-allowed"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isLocked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <span className={cn("h-2 w-2 rounded-full shrink-0", meta.dot)} />
                )}
                <span className="truncate">{slotName.replace("Analyst ", "")}</span>
                {analysis && !isLocked && (
                  <span className={cn("text-[9px] font-bold",
                    analysis.direction === "bullish" ? "text-green-500" :
                    analysis.direction === "bearish" ? "text-red-500" : "text-amber-500"
                  )}>
                    {analysis.confidence}%
                  </span>
                )}
                {/* Active indicator */}
                {isActive && (
                  <span className={cn("absolute bottom-0 left-2 right-2 h-0.5 rounded-full", meta.dot)} />
                )}
              </button>
            );
          })
        ) : (
          // Pro/Premium: show actual analyses as tabs
          analyses.map((analysis, i) => {
            const meta = ANALYST_META[analysis.model] || FALLBACK_META;
            const isActive = activeTab === i;

            return (
              <button
                key={analysis.model}
                onClick={() => setActiveTab(i)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-medium transition-all relative",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", meta.dot)} />
                <span className="truncate">{analysis.model.replace("Analyst ", "")}</span>
                <span className={cn("text-[9px] font-bold",
                  analysis.direction === "bullish" ? "text-green-500" :
                  analysis.direction === "bearish" ? "text-red-500" : "text-amber-500"
                )}>
                  {analysis.confidence}%
                </span>
                {isActive && (
                  <span className={cn("absolute bottom-0 left-2 right-2 h-0.5 rounded-full", meta.dot)} />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Tab content */}
      {activeAnalysis && (
        <div className="p-3 space-y-3">
          {/* Direction + Confidence header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", activeMeta.bg)}>
                {(() => { const Icon = activeMeta.icon; return <Icon className={cn("h-3.5 w-3.5", activeMeta.color)} />; })()}
              </div>
              <div>
                <h4 className="text-xs font-bold">{activeAnalysis.model}</h4>
                <p className="text-[9px] text-muted-foreground">{activeMeta.subtitle} · {activeMeta.label.split(" · ")[1]} weight</p>
              </div>
            </div>
            <Badge className={`${directionColor[activeAnalysis.direction]} text-xs font-bold`}>
              {directionIcon[activeAnalysis.direction]}
              <span className="ml-1">{activeAnalysis.direction} {activeAnalysis.confidence}%</span>
            </Badge>
          </div>

          {/* Analyst role description */}
          {activeMeta.description && (
            <p className={cn("text-sm leading-relaxed rounded-lg px-3 py-3 border", activeMeta.bg, activeMeta.border, "text-foreground/70")}>
              {activeMeta.description}
            </p>
          )}

          {/* Key Levels (compact) */}
          {(activeAnalysis.keyLevels.support.length > 0 || activeAnalysis.keyLevels.resistance.length > 0) && (
            <div className="flex gap-3">
              {activeAnalysis.keyLevels.support.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="font-semibold text-green-600 dark:text-green-400">S:</span>
                  <span className="font-mono text-foreground/80">
                    {activeAnalysis.keyLevels.support.slice(0, 2).map((l) => formatPrice(l, getPriceDecimals(l))).join(" / ")}
                  </span>
                </div>
              )}
              {activeAnalysis.keyLevels.resistance.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="font-semibold text-red-600 dark:text-red-400">R:</span>
                  <span className="font-mono text-foreground/80">
                    {activeAnalysis.keyLevels.resistance.slice(0, 2).map((l) => formatPrice(l, getPriceDecimals(l))).join(" / ")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reasoning */}
          <div className="text-xs text-foreground/80 leading-relaxed space-y-2">
            {formatReasoning(activeAnalysis.reasoning)}
          </div>
        </div>
      )}

      {/* Locked overlay for free tier when locked tab is somehow active */}
      {tier === "free" && activeTab > 0 && !analysisMap.get(allSlots[activeTab]) && (
        <div className="p-6 text-center">
          <Lock className="h-5 w-5 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground mb-2">Unlock Analyst Beta & Gamma</p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:text-blue-400"
          >
            <Crown className="h-3 w-3" />
            Upgrade to Pro
          </Link>
        </div>
      )}
    </div>
  );
}
