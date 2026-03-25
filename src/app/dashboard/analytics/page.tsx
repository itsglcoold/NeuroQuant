"use client";

import { useMemo } from "react";
import { useSimulator } from "@/hooks/useSimulator";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Flame,
  BarChart2,
  Brain,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { PaperTrade } from "@/types/simulator";

function calcAchievedRR(trade: PaperTrade): number | null {
  if (trade.close_price == null || trade.result_pnl == null) return null;
  const slDist = Math.abs(trade.entry_price - trade.sl_price);
  if (slDist === 0) return null;
  return Math.abs(trade.close_price - trade.entry_price) / slDist;
}

function getPnlDate(trade: PaperTrade): string {
  const d = trade.closed_at ?? trade.created_at;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyticsPage() {
  const { tier } = useUsageTracking();
  const { closedTrades, loading } = useSimulator(tier);

  const stats = useMemo(() => {
    if (closedTrades.length === 0) return null;

    const sorted = [...closedTrades].sort(
      (a, b) =>
        new Date(a.closed_at ?? a.created_at).getTime() -
        new Date(b.closed_at ?? b.created_at).getTime()
    );

    // Cumulative P&L curve
    let cum = 0;
    const pnlCurve = sorted.map((t, i) => {
      cum += t.result_pnl ?? 0;
      return { n: i + 1, label: getPnlDate(t), pnl: Math.round(cum * 100) / 100 };
    });

    const wins = closedTrades.filter((t) => (t.result_pnl ?? 0) > 0).length;
    const losses = closedTrades.filter((t) => (t.result_pnl ?? 0) < 0).length;
    const total = closedTrades.length;
    const winRate = Math.round((wins / total) * 100);

    const bestTrade = sorted.reduce((b, t) =>
      (t.result_pnl ?? 0) > (b.result_pnl ?? 0) ? t : b
    );
    const worstTrade = sorted.reduce((w, t) =>
      (t.result_pnl ?? 0) < (w.result_pnl ?? 0) ? t : w
    );

    const rrs = closedTrades
      .map(calcAchievedRR)
      .filter((r): r is number => r !== null);
    const avgRR =
      rrs.length > 0
        ? Math.round((rrs.reduce((a, b) => a + b, 0) / rrs.length) * 100) / 100
        : null;

    // Current streak (newest first)
    let streak = 0;
    let streakType: "win" | "loss" | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const isWin = (sorted[i].result_pnl ?? 0) > 0;
      if (streakType === null) {
        streakType = isWin ? "win" : "loss";
        streak = 1;
      } else if ((streakType === "win") === isWin) {
        streak++;
      } else {
        break;
      }
    }

    // Per-symbol breakdown
    const symbolMap: Record<string, { wins: number; total: number; pnl: number }> = {};
    for (const t of closedTrades) {
      if (!symbolMap[t.symbol]) symbolMap[t.symbol] = { wins: 0, total: 0, pnl: 0 };
      symbolMap[t.symbol].total++;
      symbolMap[t.symbol].pnl += t.result_pnl ?? 0;
      if ((t.result_pnl ?? 0) > 0) symbolMap[t.symbol].wins++;
    }
    const bySymbol = Object.entries(symbolMap)
      .map(([symbol, s]) => ({
        symbol,
        wins: s.wins,
        total: s.total,
        winRate: Math.round((s.wins / s.total) * 100),
        pnl: Math.round(s.pnl * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    // Long vs Short
    const longs = closedTrades.filter((t) => t.side === "long");
    const shorts = closedTrades.filter((t) => t.side === "short");
    const longWins = longs.filter((t) => (t.result_pnl ?? 0) > 0).length;
    const shortWins = shorts.filter((t) => (t.result_pnl ?? 0) > 0).length;

    // AI alignment
    const withAI = closedTrades.filter((t) => t.analysis_snapshot);
    const aligned = withAI.filter((t) => {
      const dir = t.analysis_snapshot!.consensusDirection;
      return (
        (dir === "bullish" && t.side === "long") ||
        (dir === "bearish" && t.side === "short")
      );
    });
    const alignedWins = aligned.filter((t) => (t.result_pnl ?? 0) > 0).length;
    const against = withAI.length - aligned.length;
    const againstWins = withAI
      .filter((t) => {
        const dir = t.analysis_snapshot!.consensusDirection;
        const isAligned =
          (dir === "bullish" && t.side === "long") ||
          (dir === "bearish" && t.side === "short");
        return !isAligned && (t.result_pnl ?? 0) > 0;
      }).length;

    return {
      total,
      wins,
      losses,
      winRate,
      bestTrade,
      worstTrade,
      avgRR,
      streak,
      streakType,
      pnlCurve,
      bySymbol,
      longs: {
        total: longs.length,
        wins: longWins,
        winRate: longs.length > 0 ? Math.round((longWins / longs.length) * 100) : null,
      },
      shorts: {
        total: shorts.length,
        wins: shortWins,
        winRate: shorts.length > 0 ? Math.round((shortWins / shorts.length) * 100) : null,
      },
      aiAligned: {
        total: aligned.length,
        winRate: aligned.length > 0 ? Math.round((alignedWins / aligned.length) * 100) : null,
      },
      aiAgainst: {
        total: against,
        winRate: against > 0 ? Math.round((againstWins / against) * 100) : null,
      },
    };
  }, [closedTrades]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats || closedTrades.length < 3) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Performance Analytics</h1>
        <Card className="border border-dashed border-border">
          <CardContent className="py-16 text-center">
            <BarChart2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              Not enough data yet
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Close at least 3 trades in the simulator to see your analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const finalPnl = stats.pnlCurve[stats.pnlCurve.length - 1].pnl;
  const chartColor = finalPnl >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Performance Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Based on {stats.total} closed trades
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Win Rate */}
        <Card className="border border-border/60">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Win Rate
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{stats.winRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.wins}W / {stats.losses}L
            </p>
          </CardContent>
        </Card>

        {/* Avg R:R */}
        <Card className="border border-border/60">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-purple-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Avg R:R Achieved
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {stats.avgRR !== null ? `1 : ${stats.avgRR}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">per closed trade</p>
          </CardContent>
        </Card>

        {/* Streak */}
        <Card className="border border-border/60">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame
                className={`h-4 w-4 ${
                  stats.streakType === "win" ? "text-orange-500" : "text-red-500"
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Current Streak
              </span>
            </div>
            <p
              className={`text-2xl font-bold tabular-nums ${
                stats.streakType === "win" ? "text-green-500" : "text-red-500"
              }`}
            >
              {stats.streak}×{" "}
              <span className="text-base">
                {stats.streakType === "win" ? "Win" : "Loss"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">in a row</p>
          </CardContent>
        </Card>

        {/* Best trade */}
        <Card className="border border-border/60">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Best Trade
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-green-500">
              +{(stats.bestTrade.result_pnl ?? 0).toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.bestTrade.symbol}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* P&L Curve */}
      <Card className="border border-border/60">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Cumulative P&amp;L</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.pnlCurve} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${v}%`, "P&L"]}
                labelFormatter={(l) => `Trade ${l}`}
              />
              <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Per Market + Long vs Short */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Per market */}
        <Card className="border border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Performance by Market</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {stats.bySymbol.slice(0, 8).map((s) => (
              <div key={s.symbol} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{s.symbol}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[10px]">
                      {s.wins}W / {s.total - s.wins}L
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        s.pnl >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {s.pnl >= 0 ? "+" : ""}
                      {s.pnl.toFixed(2)}%
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 ${
                        s.winRate >= 60
                          ? "text-green-500 border-green-500/30"
                          : s.winRate >= 40
                          ? "text-amber-500 border-amber-500/30"
                          : "text-red-500 border-red-500/30"
                      }`}
                    >
                      {s.winRate}%
                    </Badge>
                  </div>
                </div>
                {/* Win rate bar */}
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      s.winRate >= 60
                        ? "bg-green-500"
                        : s.winRate >= 40
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${s.winRate}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Long vs Short + AI Alignment */}
        <div className="space-y-4">
          {/* Long vs Short */}
          <Card className="border border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Long vs Short</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      Long (Bullish)
                    </span>
                  </div>
                  <p className="text-xl font-bold tabular-nums">
                    {stats.longs.winRate !== null ? `${stats.longs.winRate}%` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {stats.longs.total} trades
                  </p>
                </div>
                <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      Short (Bearish)
                    </span>
                  </div>
                  <p className="text-xl font-bold tabular-nums">
                    {stats.shorts.winRate !== null ? `${stats.shorts.winRate}%` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {stats.shorts.total} trades
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Alignment */}
          <Card className="border border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-sm font-semibold">AI Alignment</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">With AI consensus</span>
                  <span className="font-semibold">
                    {stats.aiAligned.winRate !== null
                      ? `${stats.aiAligned.winRate}% win rate`
                      : "—"}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({stats.aiAligned.total} trades)
                    </span>
                  </span>
                </div>
                {stats.aiAligned.total > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${stats.aiAligned.winRate ?? 0}%` }}
                    />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Against AI consensus</span>
                  <span className="font-semibold">
                    {stats.aiAgainst.winRate !== null
                      ? `${stats.aiAgainst.winRate}% win rate`
                      : "—"}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({stats.aiAgainst.total} trades)
                    </span>
                  </span>
                </div>
                {stats.aiAgainst.total > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${stats.aiAgainst.winRate ?? 0}%` }}
                    />
                  </div>
                )}
              </div>
              {stats.aiAligned.winRate !== null && stats.aiAgainst.winRate !== null && (
                <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/20">
                  {stats.aiAligned.winRate > stats.aiAgainst.winRate
                    ? `Following the AI improves your win rate by ${stats.aiAligned.winRate - stats.aiAgainst.winRate}%.`
                    : stats.aiAligned.winRate < stats.aiAgainst.winRate
                    ? `Interesting — you outperform the AI by ${stats.aiAgainst.winRate - stats.aiAligned.winRate}% when going against it.`
                    : "Your win rate is the same with or against AI consensus."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Worst trade note */}
      {(stats.worstTrade.result_pnl ?? 0) < -1 && (
        <Card className="border border-red-500/20 bg-red-500/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Biggest loss:</span>{" "}
              {stats.worstTrade.symbol} {(stats.worstTrade.result_pnl ?? 0).toFixed(2)}% — review it in the Simulator to see what happened.
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Analytics based on paper trades only. Past results do not predict future performance.
      </p>
    </div>
  );
}
