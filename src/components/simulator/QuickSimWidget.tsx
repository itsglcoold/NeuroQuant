"use client";

import { useState, useMemo } from "react";
import {
  Info,
  Zap,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Lock,
  AlertTriangle,
  Lightbulb,
  Clock,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { calculateATR, getATRAnalysis, priceToPips } from "@/lib/atr-calculator";
import { calculateRiskScore } from "@/lib/risk-score";
import { detectMarketRegime } from "@/lib/market-regime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConsensusResult } from "@/types/analysis";
import type { AnalysisSnapshot } from "@/types/simulator";
import type { UserTier } from "@/hooks/useUsageTracking";

// Human-readable timeframe labels
const TIMEFRAME_LABELS: Record<string, string> = {
  "1min": "1 minute",
  "5min": "5 minutes",
  "15min": "15 minutes",
  "1h": "1 hour",
  "4h": "4 hours",
  "1day": "Daily",
};

// Short timeframes that warrant a warning
const SHORT_TIMEFRAMES = ["1min", "5min"];

interface QuickSimWidgetProps {
  symbol: string;
  currentPrice: number;
  consensus: ConsensusResult;
  tier: UserTier;
  canOpenTrade: boolean;
  tradesRemaining: number;
  dailyLimit: number;
  onOpenTrade: (params: {
    symbol: string;
    side: "long" | "short";
    entryPrice: number;
    slPrice: number;
    tpPrice: number;
    analysisSnapshot?: AnalysisSnapshot;
  }) => Promise<{ success: boolean; error?: string }>;
  decimals: number;
  prefix: string;
  analysisTimeframe?: string;
  timeSeries?: Array<{ datetime: string; open: number; high: number; low: number; close: number }>;
  virtualBalance?: number;
  onSwitchTimeframe?: (newInterval: string) => void;
}

export function QuickSimWidget({
  symbol,
  currentPrice,
  consensus,
  tier,
  canOpenTrade,
  tradesRemaining,
  dailyLimit,
  onOpenTrade,
  decimals,
  prefix,
  analysisTimeframe,
  timeSeries,
  virtualBalance = 10000,
  onSwitchTimeframe,
}: QuickSimWidgetProps) {
  const aiSide: "long" | "short" =
    consensus.consensusDirection === "bearish" ? "short" : "long";

  const [side, setSide] = useState<"long" | "short">(aiSide);
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [switching, setSwitching] = useState(false);
  const [switchedConfirmation, setSwitchedConfirmation] = useState("");
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [slWasCapped, setSlWasCapped] = useState(false);

  const slNum = parseFloat(sl);
  const tpNum = parseFloat(tp);

  // Validate inputs
  const slValid =
    !isNaN(slNum) &&
    slNum > 0 &&
    (side === "long" ? slNum < currentPrice : slNum > currentPrice);
  const tpValid =
    !isNaN(tpNum) &&
    tpNum > 0 &&
    (side === "long" ? tpNum > currentPrice : tpNum < currentPrice);
  const formValid = slValid && tpValid && canOpenTrade;

  // R:R ratio
  const rrRatio =
    slValid && tpValid
      ? side === "long"
        ? (tpNum - currentPrice) / (currentPrice - slNum)
        : (currentPrice - tpNum) / (slNum - currentPrice)
      : null;
  // ATR + volatility analysis
  const atrAnalysis = useMemo(
    () =>
      timeSeries && timeSeries.length >= 15
        ? getATRAnalysis(timeSeries, symbol)
        : null,
    [timeSeries, symbol]
  );
  const atr = atrAnalysis?.value ?? 0;

  // Market regime (ADX-based)
  const regime = useMemo(
    () =>
      timeSeries && timeSeries.length >= 30
        ? detectMarketRegime(timeSeries, symbol)
        : null,
    [timeSeries, symbol]
  );

  const rrMinForRegime = regime?.regime === "trending" ? 3.0 : 2.0;
  const rrTooLow = rrRatio !== null && rrRatio < rrMinForRegime;

  // SL distance in ATR units — how much breathing room the SL has relative to market volatility
  const slDistanceInATR =
    slValid && atr > 0 ? Math.abs(currentPrice - slNum) / atr : null;

  // Risk Score (1–10)
  const riskScore =
    rrRatio !== null
      ? calculateRiskScore({
          rrRatio,
          agreementLevel: consensus.agreementLevel,
          slDistanceInATR,
        })
      : null;

  // Risk in dollars — 1% of virtual balance
  const riskDollars = (virtualBalance * 0.01).toFixed(2);

  // Low confidence warning: absolute consensus score < 40 (weak directional signal)
  const absScore = Math.abs(consensus.consensusScore);
  const lowConfidence = absScore < 40;

  // Detect if user is trading against the AI consensus
  const isAgainstConsensus =
    (consensus.consensusDirection === "bullish" && side === "short") ||
    (consensus.consensusDirection === "bearish" && side === "long");

  // Timeframe awareness
  const timeframe = analysisTimeframe || consensus.timeframe || "1day";

  // SL too tight — threshold depends on timeframe
  // Scalp (1m/5m): 0.3% | Intraday (15m/1h): 0.5% | Swing/Daily (4h/1d): 1.0%
  const slDistancePct =
    slValid ? Math.abs(currentPrice - slNum) / currentPrice : null;
  const slTightThreshold =
    ["1min", "5min"].includes(timeframe) ? 0.003 :
    ["15min", "1h"].includes(timeframe) ? 0.005 :
    0.010;
  // Use ATR-based check when available (more accurate than fixed %) — SL < 0.5× ATR is too tight
  const slTooTight = slValid
    ? atr > 0
      ? Math.abs(currentPrice - slNum) < 0.5 * atr
      : slDistancePct !== null && slDistancePct < slTightThreshold
    : false;
  const timeframeLabel = TIMEFRAME_LABELS[timeframe] || timeframe;
  const isShortTimeframe = SHORT_TIMEFRAMES.includes(timeframe);

  // Support/resistance helper values for free-tier guidance
  // Only suggest levels on the correct side of the entry price
  const { support, resistance } = consensus.mergedKeyLevels;
  const validSlSupport = support.filter((s) => s < currentPrice);
  const validSlResistance = resistance.filter((r) => r > currentPrice);
  const validTpResistance = resistance.filter((r) => r > currentPrice);
  const validTpSupport = support.filter((s) => s < currentPrice);

  const suggestedSl =
    side === "long"
      ? validSlSupport.length > 0
        ? Math.max(...validSlSupport)
        : null
      : validSlResistance.length > 0
        ? Math.min(...validSlResistance)
        : null;
  const suggestedTp =
    side === "long"
      ? validTpResistance.length > 0
        ? Math.max(...validTpResistance)
        : null
      : validTpSupport.length > 0
        ? Math.min(...validTpSupport)
        : null;

  // Auto-fill AI levels (Pro+)
  // Filter levels to only those on the correct side of the entry price.
  // For LONG: SL must be below entry, TP must be above entry.
  // For SHORT: SL must be above entry, TP must be below entry.
  // If no valid AI level exists, add a small buffer (0.3%) from entry.
  const canAutoFill = tier === "pro" || tier === "premium";
  const handleAutoFill = () => {
    setIsManualOverride(false);
    setSlWasCapped(false);
    const fallbackBuffer = currentPrice * 0.003;
    const structureBuffer = currentPrice * 0.001;

    // Dynamic R:R: trending → 1:3, ranging/unknown → 1:2
    const MIN_RR = regime?.regime === "trending" ? 3.0 : 2.0;

    // ATR-based SL bounds: floor = 1.5×ATR, ceiling = 3×ATR
    const atrFloor = atr > 0 ? atr * 1.5 : 0;
    const atrCeiling = atr > 0 ? atr * 3.0 : 0;

    if (side === "long") {
      const validSl = support.filter((s) => s < currentPrice);
      const validTp = resistance.filter((r) => r > currentPrice);

      const nearestSupport = validSl.length > 0 ? Math.max(...validSl) : currentPrice - fallbackBuffer;
      const structureSl = nearestSupport - structureBuffer;
      // Floor: SL at least 1.5×ATR below entry; ceiling: SL at most 3×ATR below entry
      const minSl = atrCeiling > 0 ? currentPrice - atrCeiling : structureSl; // ceiling = min price for SL
      const slUncapped = Math.min(structureSl, currentPrice - atrFloor); // further from entry
      const slPrice = atrCeiling > 0 ? Math.max(slUncapped, minSl) : slUncapped;
      if (atrCeiling > 0 && slUncapped < minSl) setSlWasCapped(true);
      setSl(slPrice.toFixed(decimals));

      // TP: use resistance that achieves ≥ MIN_RR, else calculate from MIN_RR
      const slDistance = currentPrice - slPrice;
      const minTp = currentPrice + MIN_RR * slDistance;
      const qualifyingTp = validTp.filter((r) => r >= minTp);
      const tpPrice = qualifyingTp.length > 0 ? Math.max(...qualifyingTp) : minTp;
      setTp(tpPrice.toFixed(decimals));
    } else {
      const validSl = resistance.filter((r) => r > currentPrice);
      const validTp = support.filter((s) => s < currentPrice);

      const nearestResistance = validSl.length > 0 ? Math.min(...validSl) : currentPrice + fallbackBuffer;
      const structureSl = nearestResistance + structureBuffer;
      // Floor: SL at least 1.5×ATR above entry; ceiling: SL at most 3×ATR above entry
      const maxSl = atrCeiling > 0 ? currentPrice + atrCeiling : structureSl;
      const slUncapped = Math.max(structureSl, currentPrice + atrFloor); // further from entry
      const slPrice = atrCeiling > 0 ? Math.min(slUncapped, maxSl) : slUncapped;
      if (atrCeiling > 0 && slUncapped > maxSl) setSlWasCapped(true);
      setSl(slPrice.toFixed(decimals));

      // TP: use support that achieves ≥ MIN_RR, else calculate from MIN_RR
      const slDistance = slPrice - currentPrice;
      const minTp = currentPrice - MIN_RR * slDistance;
      const qualifyingTp = validTp.filter((s) => s <= minTp);
      const tpPrice = qualifyingTp.length > 0 ? Math.min(...qualifyingTp) : minTp;
      setTp(tpPrice.toFixed(decimals));
    }
  };

  const handleSwitchTimeframe = () => {
    if (!onSwitchTimeframe) return;
    setSwitching(true);
    setSl("");
    setTp("");
    setSwitchedConfirmation("");
    onSwitchTimeframe("15min");
    // The parent will re-run analysis, which will unmount/remount this widget
    // with the new timeframe. Show confirmation after a delay.
    setTimeout(() => {
      setSwitching(false);
      setSwitchedConfirmation("Now on 15m: Optimal levels for medium-term trades.");
      setTimeout(() => setSwitchedConfirmation(""), 6000);
    }, 2000);
  };

  const handleSubmit = async () => {
    if (!formValid) return;
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    const snapshot: AnalysisSnapshot = {
      consensusDirection: consensus.consensusDirection,
      consensusScore: consensus.consensusScore,
      sentimentLabel: consensus.sentimentLabel,
      mergedKeyLevels: consensus.mergedKeyLevels,
    };

    const result = await onOpenTrade({
      symbol,
      side,
      entryPrice: currentPrice,
      slPrice: slNum,
      tpPrice: tpNum,
      analysisSnapshot: snapshot,
    });

    setSubmitting(false);
    if (result.success) {
      setSuccessMsg("Trade opened!");
      setSl("");
      setTp("");
      setTimeout(() => setSuccessMsg(""), 5000);
    } else {
      setErrorMsg(result.error || "Something went wrong");
    }
  };

  const formatPrice = (p: number) => `${prefix}${p.toFixed(decimals)}`;

  const sentimentLabel =
    consensus.consensusDirection === "bullish"
      ? "Bullish"
      : consensus.consensusDirection === "bearish"
        ? "Bearish"
        : "Neutral";

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-md p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Quick Simulator</h3>
            <p className="text-[10px] text-muted-foreground">
              Paper trade based on AI analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Market Regime badge */}
          {regime && (
            <Badge
              className={`text-[10px] gap-1 border ${
                regime.color === "green"
                  ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                  : regime.color === "red"
                  ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
              title={regime.tip}
            >
              {regime.label} · 1:{regime.recommendedRR > 0 ? regime.recommendedRR : "?"}
            </Badge>
          )}
          {/* ATR badge */}
          {atrAnalysis && atrAnalysis.pips > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 font-mono" title="Average True Range — typical daily move in pips">
              ATR {Math.round(atrAnalysis.pips)}p
            </Badge>
          )}
          {/* Timeframe tag */}
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Clock className="h-2.5 w-2.5" />
            {timeframeLabel}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {dailyLimit === Infinity ? "Unlimited" : `${tradesRemaining}/${dailyLimit}`} trades
          </Badge>
        </div>
      </div>

      {/* Volatility spike warning */}
      {atrAnalysis?.isVolatile && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-red-600 dark:text-red-400">
            <span className="font-bold">Volatility spike detected</span> — ATR is {atrAnalysis.ratio.toFixed(1)}× above average.
            Market conditions are unstable. Consider waiting for calmer conditions before entering.
          </p>
        </div>
      )}

      {/* Timeframe Awareness Warning — short timeframes */}
      {isShortTimeframe && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-2 animate-[pulse_2s_ease-in-out_1]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1.5">
              <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                <span className="font-bold">Heads up:</span> This analysis is based on
                the <span className="font-bold">{timeframeLabel}</span> chart. The
                suggested SL/TP levels are very tight and best suited for quick scalp
                trades. For &quot;Set &amp; Forget&quot; trades, we recommend a higher
                timeframe (15m+).
              </p>
              <div className="flex items-center gap-2">
                {onSwitchTimeframe && (
                  <button
                    onClick={handleSwitchTimeframe}
                    disabled={switching}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 transition-colors"
                  >
                    {switching ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Switching...
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        Switch to 15 min
                      </>
                    )}
                  </button>
                )}
                <span className="relative group">
                  <Info className="h-3.5 w-3.5 text-amber-500/60 cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-52 rounded-md bg-popover border border-border p-2.5 text-[10px] font-normal text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                    Short-timeframe charts show a lot of &quot;noise&quot; (small temporary
                    spikes and dips). A Stop-Loss at this level gets hit more often by
                    chance. A 15-minute analysis looks at the bigger trend, giving your
                    trade more breathing room.
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Switched confirmation */}
      {switchedConfirmation && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-2.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
          <p className="text-[11px] text-green-600 dark:text-green-400 font-medium">
            {switchedConfirmation}
          </p>
        </div>
      )}

      {/* AI Pre-selection Context */}
      {consensus.consensusDirection !== "neutral" && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-500/5 border border-blue-500/20 p-2.5">
          <Lightbulb className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-blue-600 dark:text-blue-400">
            AI analysis is <span className="font-bold">{sentimentLabel}</span>, so we
            pre-selected{" "}
            <span className="font-bold">
              {aiSide === "long" ? "Buy" : "Sell"}
            </span>{" "}
            for you.
          </p>
        </div>
      )}

      {/* Side Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => { setSide("long"); setIsManualOverride(false); setSlWasCapped(false); }}
          className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 transition-all ${
            side === "long"
              ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400 shadow-sm"
              : "border-border text-muted-foreground hover:border-green-500/40"
          }`}
        >
          <span className="flex items-center gap-1.5 text-xs font-bold">
            <TrendingUp className="h-3.5 w-3.5" />
            BUY
          </span>
          <span className="text-[9px] opacity-70 font-medium">Bet on rise</span>
        </button>
        <button
          onClick={() => { setSide("short"); setIsManualOverride(false); setSlWasCapped(false); }}
          className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 transition-all ${
            side === "short"
              ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 shadow-sm"
              : "border-border text-muted-foreground hover:border-red-500/40"
          }`}
        >
          <span className="flex items-center gap-1.5 text-xs font-bold">
            <TrendingDown className="h-3.5 w-3.5" />
            SELL
          </span>
          <span className="text-[9px] opacity-70 font-medium">Bet on decline</span>
        </button>
      </div>

      {/* Consensus Deviation Warning */}
      {isAgainstConsensus && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            <span className="font-semibold">Heads up:</span> AI analysts expect a{" "}
            {consensus.consensusDirection === "bullish" ? "rise" : "decline"}.
            You&apos;re trading against the consensus — make sure this is intentional.
          </p>
        </div>
      )}

      {/* Entry Price */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
          Entry Price
        </label>
        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-bold tabular-nums">
          {formatPrice(currentPrice)}
        </div>
      </div>

      {/* SL / TP Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Stop-Loss
            <span className="relative group">
              <Info className="h-3 w-3 cursor-help" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-44 rounded-md bg-popover border border-border p-2 text-[10px] font-normal normal-case tracking-normal text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                Your safety net — if the price moves against you and hits this level, the trade closes automatically to limit your loss.
              </span>
            </span>
          </label>
          <Input
            data-tour="sl-tp"
            type="number"
            step="any"
            placeholder={side === "long" ? `< ${formatPrice(currentPrice)}` : `> ${formatPrice(currentPrice)}`}
            value={sl}
            onChange={(e) => { setSl(e.target.value); setIsManualOverride(true); setSlWasCapped(false); }}
            className={`text-sm tabular-nums ${
              sl && !slValid ? "border-red-500 focus-visible:ring-red-500" : ""
            }`}
          />
          {sl && !slValid && (
            <p className="text-[10px] text-red-500 mt-0.5">
              {side === "long" ? "Must be below entry price" : "Must be above entry price"}
            </p>
          )}
          {/* SL width in pips */}
          {slValid && atr > 0 && (() => {
            const slPips = Math.round(priceToPips(symbol, Math.abs(currentPrice - slNum)));
            const atrPips = Math.round(atrAnalysis!.pips);
            const ratio = slPips / atrPips;
            const color = ratio > 3 ? "text-red-500" : ratio > 2 ? "text-amber-500" : "text-green-500";
            return (
              <p className={`text-[10px] mt-0.5 font-mono ${color}`}>
                SL: {slPips}p &nbsp;·&nbsp; ATR: {atrPips}p &nbsp;·&nbsp; {ratio.toFixed(1)}×ATR
              </p>
            );
          })()}
          {/* Free-tier helper: show suggested SL value */}
          {!canAutoFill && suggestedSl !== null && !sl && (
            <p className="text-[10px] text-red-500/80 mt-1 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500/60" />
              AI {side === "long" ? "support" : "resistance"}:{" "}
              <button
                type="button"
                onClick={() => setSl(suggestedSl.toFixed(decimals))}
                className="font-bold tabular-nums underline decoration-dotted underline-offset-2 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                {formatPrice(suggestedSl)}
              </button>
            </p>
          )}
        </div>
        <div>
          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Take-Profit
            <span className="relative group">
              <Info className="h-3 w-3 cursor-help" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-44 rounded-md bg-popover border border-border p-2 text-[10px] font-normal normal-case tracking-normal text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                Your profit target — when the price reaches this level, the trade closes automatically and you lock in your gains.
              </span>
            </span>
          </label>
          <Input
            type="number"
            step="any"
            placeholder={side === "long" ? `> ${formatPrice(currentPrice)}` : `< ${formatPrice(currentPrice)}`}
            value={tp}
            onChange={(e) => { setTp(e.target.value); setIsManualOverride(true); }}
            className={`text-sm tabular-nums ${
              tp && !tpValid ? "border-red-500 focus-visible:ring-red-500" : ""
            }`}
          />
          {tp && !tpValid && (
            <p className="text-[10px] text-red-500 mt-0.5">
              {side === "long" ? "Must be above entry price" : "Must be below entry price"}
            </p>
          )}
          {/* Free-tier helper: show suggested TP value */}
          {!canAutoFill && suggestedTp !== null && !tp && (
            <p className="text-[10px] text-green-500/80 mt-1 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500/60" />
              AI {side === "long" ? "resistance" : "support"}:{" "}
              <button
                type="button"
                onClick={() => setTp(suggestedTp.toFixed(decimals))}
                className="font-bold tabular-nums underline decoration-dotted underline-offset-2 hover:text-green-600 dark:hover:text-green-400 transition-colors"
              >
                {formatPrice(suggestedTp)}
              </button>
            </p>
          )}
        </div>
      </div>

      {/* R:R Ratio + warnings */}
      {rrRatio !== null && (
        <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
          rrTooLow
            ? "border-amber-500/40 bg-amber-500/8"
            : "border-green-500/30 bg-green-500/5"
        }`}>
          <span className="text-[11px] font-semibold text-muted-foreground">Risk:Reward</span>
          <span className={`text-sm font-bold tabular-nums ${rrTooLow ? "text-amber-500" : "text-green-500"}`}>
            1 : {rrRatio.toFixed(2)}
          </span>
        </div>
      )}
      {/* Risk Score */}
      {riskScore !== null && (
        <div className={`rounded-lg border p-3 ${
          riskScore.color === "green" ? "border-green-500/30 bg-green-500/5" :
          riskScore.color === "blue"  ? "border-blue-500/30 bg-blue-500/5" :
          riskScore.color === "amber" ? "border-amber-500/30 bg-amber-500/5" :
          "border-red-500/30 bg-red-500/5"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold tabular-nums ${
                riskScore.color === "green" ? "text-green-500" :
                riskScore.color === "blue"  ? "text-blue-500" :
                riskScore.color === "amber" ? "text-amber-500" :
                "text-red-500"
              }`}>
                {riskScore.score}/10
              </span>
              <div>
                <p className={`text-[11px] font-bold ${
                  riskScore.color === "green" ? "text-green-600 dark:text-green-400" :
                  riskScore.color === "blue"  ? "text-blue-600 dark:text-blue-400" :
                  riskScore.color === "amber" ? "text-amber-600 dark:text-amber-400" :
                  "text-red-600 dark:text-red-400"
                }`}>
                  {riskScore.grade}
                </p>
                <p className="text-[10px] text-muted-foreground">{riskScore.explanation}</p>
              </div>
            </div>
            {slValid && (
              <p className="text-[10px] text-muted-foreground text-right shrink-0">
                1% risk<br />
                <span className="font-semibold tabular-nums">${riskDollars}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {rrTooLow && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            <span className="font-semibold">R:R below 1:{rrMinForRegime}</span> — {regime?.regime === "trending" ? "trending market, target 1:3 to let winners run." : "your TP is less than 2× your SL distance."} Move TP further or SL closer to entry.
          </p>
        </div>
      )}
      {slTooTight && (
        <div className="flex items-start gap-2 rounded-lg bg-orange-500/10 border border-orange-500/30 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-orange-600 dark:text-orange-400">
            <span className="font-semibold">SL very tight</span> — less than {(slTightThreshold * 100).toFixed(1)}% from entry for this timeframe. Normal price fluctuations may trigger it early.
          </p>
        </div>
      )}
      {slWasCapped && !isManualOverride && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-blue-600 dark:text-blue-400">
            <span className="font-semibold">SL adjusted to 3×ATR</span> — the AI support/resistance level was too far from entry. SL was capped to keep risk manageable.
          </p>
        </div>
      )}
      {lowConfidence && (
        <div className="flex items-start gap-2 rounded-lg bg-zinc-500/10 border border-zinc-500/30 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-zinc-400">
            <span className="font-semibold">Low AI confidence ({absScore}%)</span> — the analysts don&apos;t strongly agree on direction. Consider waiting for a clearer signal.
          </p>
        </div>
      )}
      {isManualOverride && (
        <div className="flex items-start gap-2 rounded-lg bg-orange-500/10 border border-orange-500/30 p-2.5">
          <ShieldAlert className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-orange-600 dark:text-orange-400">
            <span className="font-semibold">Manual override.</span> You&apos;ve changed the AI-suggested levels. This trade is your own responsibility.
          </p>
        </div>
      )}

      {/* Auto-fill AI Button */}
      {canAutoFill ? (
        <button
          onClick={handleAutoFill}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
        >
          <Zap className="h-3.5 w-3.5" />
          Auto-fill Stop Loss / Take Profit
        </button>
      ) : (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Auto-fill via AI — upgrade to Pro
        </div>
      )}

      {/* Open Trade Button */}
      <Button
        data-tour="open-trade"
        onClick={handleSubmit}
        disabled={!formValid || submitting}
        className={`w-full font-bold ${
          side === "long"
            ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            : "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
        } text-white shadow-md`}
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Opening...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Open {side === "long" ? "Buy" : "Sell"} Trade
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>

      {/* Messages */}
      {successMsg && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2.5 text-xs text-green-600 dark:text-green-400 flex items-center justify-between">
          <span>{successMsg}</span>
          <a
            href="/dashboard/simulator"
            className="flex items-center gap-1 font-semibold hover:underline"
          >
            View trades <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-600 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      {!canOpenTrade && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-600 dark:text-amber-400">
          Daily limit reached ({dailyLimit} trades). You can trade again tomorrow!
        </div>
      )}
    </div>
  );
}
