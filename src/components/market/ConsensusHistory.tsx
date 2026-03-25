"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, History } from "lucide-react";

interface HistoryEntry {
  id: string;
  consensus_direction: string;
  consensus_score: number;
  agreement_level: string;
  created_at: string;
}

function DirectionDot({ direction }: { direction: string }) {
  if (direction === "bullish")
    return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (direction === "bearish")
    return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-amber-500" />;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function ConsensusHistory({ symbol }: { symbol: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("market_analyses")
        .select("id, consensus_direction, consensus_score, agreement_level, created_at")
        .eq("symbol", symbol)
        .order("created_at", { ascending: false })
        .limit(7);
      if (data) setHistory(data as HistoryEntry[]);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  if (history.length === 0) return null;

  // Consecutive streak of same direction
  const latest = history[0].consensus_direction;
  let streak = 0;
  for (const h of history) {
    if (h.consensus_direction === latest) streak++;
    else break;
  }

  return (
    <Card className="border border-border/60">
      <CardHeader className="pb-1 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Analysis History
            </CardTitle>
          </div>
          {streak >= 2 && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              latest === "bullish" ? "bg-green-500/10 text-green-500" :
              latest === "bearish" ? "bg-red-500/10 text-red-500" :
              "bg-amber-500/10 text-amber-500"
            }`}>
              {streak}× {latest} in a row
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {history.map((h) => (
            <div
              key={h.id}
              title={`${h.consensus_direction} · Score: ${h.consensus_score} · ${timeAgo(h.created_at)}`}
              className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 border text-[10px] ${
                h.consensus_direction === "bullish"
                  ? "bg-green-500/5 border-green-500/20"
                  : h.consensus_direction === "bearish"
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-amber-500/5 border-amber-500/20"
              }`}
            >
              <DirectionDot direction={h.consensus_direction} />
              <span className="text-muted-foreground/70">{timeAgo(h.created_at)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
