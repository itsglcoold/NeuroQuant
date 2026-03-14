"use client";

import { useState } from "react";
import { Info, Zap, TrendingUp, TrendingDown, ArrowRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConsensusResult } from "@/types/analysis";
import type { AnalysisSnapshot } from "@/types/simulator";
import type { UserTier } from "@/hooks/useUsageTracking";

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
}: QuickSimWidgetProps) {
  const [side, setSide] = useState<"long" | "short">(
    consensus.consensusDirection === "bearish" ? "short" : "long"
  );
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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

  // Auto-fill AI levels (Pro+)
  const canAutoFill = tier === "pro" || tier === "premium";
  const handleAutoFill = () => {
    const { support, resistance } = consensus.mergedKeyLevels;
    if (side === "long") {
      if (support.length > 0) setSl(Math.min(...support).toFixed(decimals));
      if (resistance.length > 0) setTp(Math.max(...resistance).toFixed(decimals));
    } else {
      if (resistance.length > 0) setSl(Math.max(...resistance).toFixed(decimals));
      if (support.length > 0) setTp(Math.min(...support).toFixed(decimals));
    }
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
      setSuccessMsg("Trade geopend!");
      setSl("");
      setTp("");
      setTimeout(() => setSuccessMsg(""), 5000);
    } else {
      setErrorMsg(result.error || "Er ging iets mis");
    }
  };

  const formatPrice = (p: number) => `${prefix}${p.toFixed(decimals)}`;

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
              Paper trade op basis van AI analyse
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {tradesRemaining}/{dailyLimit === Infinity ? "\u221E" : dailyLimit} trades
        </Badge>
      </div>

      {/* Side Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSide("long")}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
            side === "long"
              ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400 shadow-sm"
              : "border-border text-muted-foreground hover:border-green-500/40"
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Buy (Long)
        </button>
        <button
          onClick={() => setSide("short")}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
            side === "short"
              ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 shadow-sm"
              : "border-border text-muted-foreground hover:border-red-500/40"
          }`}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          Sell (Short)
        </button>
      </div>

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
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-40 rounded-md bg-popover border border-border p-2 text-[10px] font-normal normal-case tracking-normal text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                Je vangnet - de maximale verlies die je accepteert
              </span>
            </span>
          </label>
          <Input
            type="number"
            step="any"
            placeholder={side === "long" ? `< ${formatPrice(currentPrice)}` : `> ${formatPrice(currentPrice)}`}
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            className={`text-sm tabular-nums ${
              sl && !slValid ? "border-red-500 focus-visible:ring-red-500" : ""
            }`}
          />
          {sl && !slValid && (
            <p className="text-[10px] text-red-500 mt-0.5">
              {side === "long" ? "Moet lager zijn dan entry" : "Moet hoger zijn dan entry"}
            </p>
          )}
        </div>
        <div>
          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Take-Profit
            <span className="relative group">
              <Info className="h-3 w-3 cursor-help" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-40 rounded-md bg-popover border border-border p-2 text-[10px] font-normal normal-case tracking-normal text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                Je winstdoel - hier sluit je trade automatisch
              </span>
            </span>
          </label>
          <Input
            type="number"
            step="any"
            placeholder={side === "long" ? `> ${formatPrice(currentPrice)}` : `< ${formatPrice(currentPrice)}`}
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            className={`text-sm tabular-nums ${
              tp && !tpValid ? "border-red-500 focus-visible:ring-red-500" : ""
            }`}
          />
          {tp && !tpValid && (
            <p className="text-[10px] text-red-500 mt-0.5">
              {side === "long" ? "Moet hoger zijn dan entry" : "Moet lager zijn dan entry"}
            </p>
          )}
        </div>
      </div>

      {/* Auto-fill AI Button */}
      {canAutoFill ? (
        <button
          onClick={handleAutoFill}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
        >
          <Zap className="h-3.5 w-3.5" />
          Auto-fill via AI (Support/Resistance)
        </button>
      ) : (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Auto-fill via AI — upgrade naar Pro
        </div>
      )}

      {/* Open Trade Button */}
      <Button
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
            Bekijk trades <ArrowRight className="h-3 w-3" />
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
          Dagelijkse limiet bereikt ({dailyLimit} trades). Morgen kun je weer traden!
        </div>
      )}
    </div>
  );
}
