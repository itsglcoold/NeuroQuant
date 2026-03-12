"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TradingChart } from "@/components/dashboard/TradingChart";
import { MarketSwitcher } from "@/components/dashboard/MarketSwitcher";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import { getMarketBySymbol, getMarketEmoji, CATEGORY_COLORS } from "@/lib/market/symbols";
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
} from "lucide-react";

export const runtime = 'edge';

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

export default function MarketDetailPage() {
  const params = useParams();
  const symbol = decodeURIComponent(params.symbol as string);
  const market = getMarketBySymbol(symbol);

  const [price, setPrice] = useState<MarketPrice | null>(null);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { canRunAnalysis, consumeAnalysis, analysesRemaining, analysesTotal, tier } = useUsageTracking();

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

  async function runAnalysis() {
    if (!canRunAnalysis) {
      setShowUpgradeModal(true);
      return;
    }

    setAnalyzing(true);
    consumeAnalysis();

    try {
      const res = await fetch("/api/analysis/technical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });

      if (res.ok) {
        const data = await res.json();
        setConsensus(data.consensus);
        if (data.price) setPrice(data.price);
        if (data.indicators) setIndicators(data.indicators);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
    }
    setAnalyzing(false);
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
            <h1 className="text-xl font-bold leading-tight">
              {market?.name || symbol}
            </h1>
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

      {/* Chart + AI Panel (side by side on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart — 2/3 width */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-4 pb-2 px-3">
              <TradingChart symbol={symbol} height={420} />
            </CardContent>
          </Card>
        </div>

        {/* AI Analysis Panel — 1/3 width */}
        <div className="lg:col-span-1 space-y-4">
          {/* Run Analysis Button */}
          <div className="space-y-1.5">
            <Button
              onClick={runAnalysis}
              disabled={analyzing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {analyzing ? "Analyzing..." : "Run AI Analysis"}
            </Button>
            {tier === "free" && analysesTotal !== Infinity && (
              <p className="text-center text-[10px] text-muted-foreground">
                {analysesRemaining} of {analysesTotal} free analyses remaining today
              </p>
            )}
          </div>

          <UpgradeModal
            open={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            feature="ai-analysis"
            requiredTier="pro"
            reason="limit-reached"
          />

          {/* Consensus Card */}
          {consensus ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  AI Consensus
                  {directionIcon[consensus.consensusDirection]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Direction + Agreement */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={directionColor[consensus.consensusDirection]}>
                    {consensus.consensusDirection.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {consensus.agreementLevel} agreement
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {consensus.consensusScore > 0 ? "+" : ""}
                    {consensus.consensusScore}
                  </span>
                </div>

                {/* Sentiment Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Bearish</span>
                    <span>Bullish</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30"
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-foreground rounded"
                      style={{
                        left: `${((consensus.consensusScore + 100) / 200) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Key Levels */}
                {(consensus.mergedKeyLevels.support.length > 0 ||
                  consensus.mergedKeyLevels.resistance.length > 0) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-green-500 mb-1">
                        Support
                      </h4>
                      {consensus.mergedKeyLevels.support.slice(0, 3).map((level, i) => (
                        <p key={i} className="text-xs tabular-nums text-foreground/80">
                          {prefix}
                          {formatPrice(level, decimals)}
                        </p>
                      ))}
                    </div>
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1">
                        Resistance
                      </h4>
                      {consensus.mergedKeyLevels.resistance.slice(0, 3).map((level, i) => (
                        <p key={i} className="text-xs tabular-nums text-foreground/80">
                          {prefix}
                          {formatPrice(level, decimals)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {consensus.summary}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Click &quot;Run AI Analysis&quot; to get consensus insights from
                our triple-AI engine.
              </CardContent>
            </Card>
          )}

          {/* Individual Model Cards */}
          {consensus?.individualAnalyses.map((analysis, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2">
                  {analysis.model}
                  {directionIcon[analysis.direction]}
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {analysis.confidence}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-foreground/80 leading-relaxed line-clamp-6">
                  {analysis.reasoning}
                </p>
              </CardContent>
            </Card>
          ))}

          {/* Disclaimer */}
          {consensus && (
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              {consensus.disclaimer}
            </p>
          )}
        </div>
      </div>

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
