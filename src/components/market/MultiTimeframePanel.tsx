"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Direction = "bullish" | "bearish" | "neutral";

interface TFResult {
  direction: Direction;
  confidence: number;
}

interface MTFData {
  "1h": TFResult;
  "4h": TFResult;
  "1day": TFResult;
}

interface Props {
  symbol: string;
}

const TF_LABELS: Record<string, string> = {
  "1h": "1H",
  "4h": "4H",
  "1day": "Daily",
};

function DirectionBadge({ direction, confidence }: TFResult) {
  if (direction === "bullish") {
    return (
      <div className="flex items-center gap-1 rounded-md bg-green-500/10 border border-green-500/20 px-2 py-1">
        <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
        <span className="text-xs font-semibold text-green-600 dark:text-green-400">Bullish</span>
        <span className="text-[10px] text-green-500/70 ml-0.5">{confidence}%</span>
      </div>
    );
  }
  if (direction === "bearish") {
    return (
      <div className="flex items-center gap-1 rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1">
        <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
        <span className="text-xs font-semibold text-red-600 dark:text-red-400">Bearish</span>
        <span className="text-[10px] text-red-500/70 ml-0.5">{confidence}%</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1">
      <Minus className="h-3 w-3 text-amber-500 shrink-0" />
      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Neutral</span>
      <span className="text-[10px] text-amber-500/70 ml-0.5">{confidence}%</span>
    </div>
  );
}

function getConfluence(data: MTFData): { label: string; color: string; count: number } {
  const dirs = [data["1h"].direction, data["4h"].direction, data["1day"].direction];
  const bullish = dirs.filter((d) => d === "bullish").length;
  const bearish = dirs.filter((d) => d === "bearish").length;

  if (bullish === 3) return { label: "Strong Bullish Confluence", color: "text-green-500", count: 3 };
  if (bearish === 3) return { label: "Strong Bearish Confluence", color: "text-red-500", count: 3 };
  if (bullish === 2) return { label: "Moderate Bullish Confluence", color: "text-green-400", count: 2 };
  if (bearish === 2) return { label: "Moderate Bearish Confluence", color: "text-red-400", count: 2 };
  return { label: "Mixed Signals", color: "text-amber-500", count: 1 };
}

export function MultiTimeframePanel({ symbol }: Props) {
  const [data, setData] = useState<MTFData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/analysis/mtf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setData(json.results);
      setLastUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Auto-load on mount
  useEffect(() => {
    load();
  }, [load]);

  const confluence = data ? getConfluence(data) : null;

  return (
    <Card className="border border-border/60">
      <CardContent className="py-3 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Multi-Timeframe Confluence
            </p>
            {confluence && !loading && (
              <p className={`text-xs font-semibold mt-0.5 ${confluence.color}`}>
                {confluence.label} ({confluence.count}/3)
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {loading ? "Analyzing…" : "Refresh"}
          </button>
        </div>

        {/* Timeframe cards */}
        {loading && !data ? (
          <div className="grid grid-cols-3 gap-2">
            {["1H", "4H", "Daily"].map((tf) => (
              <div key={tf} className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground text-center">{tf}</p>
                <div className="h-8 rounded-md bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Could not load — click Refresh to retry.
          </p>
        ) : data ? (
          <div className="grid grid-cols-3 gap-2">
            {(["1h", "4h", "1day"] as const).map((tf) => (
              <div key={tf} className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground text-center">
                  {TF_LABELS[tf]}
                </p>
                <div className="flex justify-center">
                  <DirectionBadge {...data[tf]} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {lastUpdated && !loading && (
          <p className="text-[9px] text-muted-foreground/40 text-right mt-2">
            Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · cached 30 min
          </p>
        )}
      </CardContent>
    </Card>
  );
}
