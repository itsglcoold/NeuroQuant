"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useSimulator } from "@/hooks/useSimulator";
import { useTradeWatcher } from "@/hooks/useTradeWatcher";
import { useMarketData } from "@/hooks/useMarketData";
import { INITIAL_VIRTUAL_BALANCE } from "@/types/simulator";
import type { PaperTrade } from "@/types/simulator";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  DollarSign,
  Activity,
  ExternalLink,
  X,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  BookOpen,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  Zap,
  PlayCircle,
} from "lucide-react";

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(2)}%`;
}

function formatDollarPnl(pnlPercent: number): string {
  const dollarPnl = (pnlPercent / 100) * INITIAL_VIRTUAL_BALANCE;
  const sign = dollarPnl >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(dollarPnl).toFixed(2)}`;
}

function getPriceDisplay(price: number): string {
  return price > 100 ? price.toFixed(2) : price.toFixed(4);
}

// Calculate live P/L for an open trade
function calcLivePnl(trade: PaperTrade, currentPrice: number): number {
  if (trade.side === "long") {
    return ((currentPrice - trade.entry_price) / trade.entry_price) * 100;
  }
  return ((trade.entry_price - currentPrice) / trade.entry_price) * 100;
}

export default function SimulatorPage() {
  const { tier, refreshMs } = useUsageTracking();
  const {
    openTrades,
    closedTrades,
    stats,
    loading,
    canOpenTrade,
    tradesRemaining,
    dailyLimit,
    closeTrade,
    deleteTrade,
    resetSimulator,
    refetch,
  } = useSimulator(tier);

  const [closedNotifications, setClosedNotifications] = useState<
    { symbol: string; pnl: number }[]
  >([]);

  // Trade journal: tradeId → { review, loading, open }
  const [journalState, setJournalState] = useState<
    Record<string, { review: string | null; loading: boolean; open: boolean }>
  >({});

  const fetchReview = useCallback(async (trade: (typeof closedTrades)[number]) => {
    const current = journalState[trade.id];
    // Toggle closed if already open
    if (current?.open) {
      setJournalState((prev) => ({ ...prev, [trade.id]: { ...prev[trade.id], open: false } }));
      return;
    }
    // Show cached
    if (current?.review) {
      setJournalState((prev) => ({ ...prev, [trade.id]: { ...prev[trade.id], open: true } }));
      return;
    }
    // Fetch from API
    setJournalState((prev) => ({ ...prev, [trade.id]: { review: null, loading: true, open: true } }));
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          entryPrice: trade.entry_price,
          closePrice: trade.close_price,
          pnlPercent: trade.result_pnl,
          slPrice: trade.sl_price,
          tpPrice: trade.tp_price,
          createdAt: trade.created_at,
          closedAt: trade.closed_at,
        }),
      });
      const data = await res.json();
      setJournalState((prev) => ({
        ...prev,
        [trade.id]: { review: data.review ?? "Review unavailable.", loading: false, open: true },
      }));
    } catch {
      setJournalState((prev) => ({
        ...prev,
        [trade.id]: { review: "Could not load review.", loading: false, open: true },
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalState]);

  // WebSocket prices for trade watcher (avoids REST polling)
  const { prices: wsPrices } = useMarketData();

  // Trade watcher for auto-closing — uses WebSocket prices
  useTradeWatcher({
    openTrades,
    refreshMs,
    closeTrade,
    wsPrices,
    onTradeClosed: (trade, _closePrice, pnl) => {
      setClosedNotifications((prev) => [
        { symbol: trade.symbol, pnl },
        ...prev.slice(0, 4),
      ]);
      refetch();
      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setClosedNotifications((prev) => prev.slice(0, -1));
      }, 8000);
    },
  });


  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {closedNotifications.map((notif, i) => (
        <div
          key={i}
          className={`rounded-xl border p-3 flex items-center justify-between text-sm font-medium animate-in slide-in-from-top-2 ${
            notif.pnl >= 0
              ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
          }`}
        >
          <span>
            {notif.symbol} trade closed: {formatPnl(notif.pnl)} ({formatDollarPnl(notif.pnl)})
          </span>
          <button
            onClick={() =>
              setClosedNotifications((prev) => prev.filter((_, idx) => idx !== i))
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-2xl font-bold">Trading Simulator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paper trading based on AI analyses —{" "}
          {dailyLimit === Infinity
            ? "Unlimited trades"
            : `${tradesRemaining}/${dailyLimit} trades today`}
        </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
          onClick={async () => {
            if (confirm("Reset simulator? This will delete ALL trades and restore your $10,000 balance.")) {
              await resetSimulator();
            }
          }}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset
        </Button>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border border-border/60">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Virtual Balance
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              ${stats.virtualBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            {stats.totalPnl !== 0 && (
              <p
                className={`text-xs font-medium ${
                  stats.totalPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {formatPnl(stats.totalPnl)} total
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                AI Accuracy
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {stats.totalTrades > 0 ? `${stats.accuracy}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.winCount}W / {stats.lossCount}L
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Active Trades
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">{stats.activeTrades}</p>
            <p className="text-xs text-muted-foreground">
              {stats.totalTrades} closed
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-purple-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total P/L
              </span>
            </div>
            <p
              className={`text-lg font-bold tabular-nums ${
                stats.totalPnl >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {stats.totalTrades > 0 ? formatPnl(stats.totalPnl) : "—"}
            </p>
            {stats.totalTrades > 0 && (
              <p className={`text-xs font-medium ${stats.totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatDollarPnl(stats.totalPnl)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty state — no trades at all */}
      {openTrades.length === 0 && closedTrades.length === 0 && (
        <Card className="border border-dashed border-blue-500/20 bg-blue-500/5">
          <CardContent className="py-8 px-6 space-y-6">
            <div className="text-center space-y-1">
              <p className="font-semibold text-base">How to open your first trade</p>
              <p className="text-sm text-muted-foreground">
                The simulator uses virtual money ($10,000). Follow these 3 steps:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Search,
                  step: "1",
                  title: "Pick a market",
                  desc: "Go to any market below — e.g. Gold or EUR/USD.",
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                },
                {
                  icon: Zap,
                  step: "2",
                  title: "Run AI Analysis",
                  desc: 'Click "Run Analysis" on the market page. The AI gives you a Bullish or Bearish signal.',
                  color: "text-amber-500",
                  bg: "bg-amber-500/10",
                },
                {
                  icon: PlayCircle,
                  step: "3",
                  title: "Open a trade",
                  desc: "In the simulator widget, choose direction, auto-fill SL/TP, and click Open Trade.",
                  color: "text-green-500",
                  bg: "bg-green-500/10",
                },
              ].map(({ icon: Icon, step, title, desc, color, bg }) => (
                <div key={step} className="flex gap-3">
                  <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Step {step}</p>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border/40 pt-4">
              <p className="text-xs text-muted-foreground mb-3 text-center">Start with a popular market:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { label: "Gold", symbol: "XAU/USD" },
                  { label: "EUR/USD", symbol: "EUR/USD" },
                  { label: "GBP/USD", symbol: "GBP/USD" },
                  { label: "Crude Oil", symbol: "CL" },
                  { label: "S&P 500", symbol: "SPX" },
                ].map(({ label, symbol }) => (
                  <Link
                    key={symbol}
                    href={`/dashboard/market/${encodeURIComponent(symbol)}`}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted hover:border-blue-500/30 hover:text-blue-500 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Trades */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500" />
          Active Trades
        </h2>
        {openTrades.length === 0 ? (
          <Card className="border border-dashed border-border">
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No active trades. Pick a market above and run an AI analysis to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {openTrades.map((trade) => {
              const livePrice = wsPrices[trade.symbol]?.price ?? null;
              const pnlPct = livePrice
                ? trade.side === "long"
                  ? ((livePrice - trade.entry_price) / trade.entry_price) * 100
                  : ((trade.entry_price - livePrice) / trade.entry_price) * 100
                : null;
              const pnlDollar = pnlPct !== null ? (stats.virtualBalance * pnlPct) / 100 : null;
              const isProfit = pnlPct !== null && pnlPct >= 0;
              const snap = trade.analysis_snapshot;
              const rrRatio = snap?.rrRatio ??
                Math.abs(trade.tp_price - trade.entry_price) / Math.abs(trade.sl_price - trade.entry_price);

              return (
                <Card key={trade.id} className={`border ${isProfit ? "border-green-500/30" : "border-red-500/30"}`}>
                  <CardContent className="py-3 px-4 space-y-2.5">
                    {/* Header: symbol + direction + P&L */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/dashboard/market/${encodeURIComponent(trade.symbol)}`}
                          className="font-bold text-sm hover:text-blue-500 hover:underline transition-colors"
                        >
                          {trade.symbol}
                        </Link>
                        <Badge className={trade.side === "long"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                          : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                        }>
                          {trade.side === "long"
                            ? <TrendingUp className="h-3 w-3 mr-1" />
                            : <TrendingDown className="h-3 w-3 mr-1" />}
                          {trade.side === "long" ? "BUY" : "SELL"}
                        </Badge>
                      </div>
                      {pnlPct !== null && (
                        <span className={`text-sm font-bold tabular-nums shrink-0 ${isProfit ? "text-green-500" : "text-red-500"}`}>
                          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                          {pnlDollar !== null && (
                            <span className="font-normal opacity-80"> ({pnlDollar >= 0 ? "+" : "-"}${Math.abs(pnlDollar).toFixed(2)})</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Entry / SL / TP */}
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Entry</p>
                        <p className="font-semibold tabular-nums">{getPriceDisplay(trade.entry_price)}</p>
                      </div>
                      <div>
                        <p className="text-red-500">SL</p>
                        <p className="font-semibold tabular-nums">{getPriceDisplay(trade.sl_price)}</p>
                      </div>
                      <div>
                        <p className="text-green-500">TP</p>
                        <p className="font-semibold tabular-nums">{getPriceDisplay(trade.tp_price)}</p>
                      </div>
                    </div>

                    {/* Metadata: R:R, Risk, ATR, Regime, AI */}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
                      <span>R:R <span className="text-foreground font-semibold">1:{rrRatio.toFixed(1)}</span></span>
                      {snap?.riskScore !== undefined && (
                        <span>Score <span className={`font-semibold ${snap.riskScore >= 7 ? "text-green-500" : snap.riskScore >= 4 ? "text-amber-500" : "text-red-500"}`}>{snap.riskScore}/10</span></span>
                      )}
                      {snap?.atrPips !== undefined && snap.atrLabel && (
                        <span>ATR <span className="text-foreground font-semibold">{snap.atrPips}{snap.atrLabel}</span></span>
                      )}
                      {snap && (
                        <span className={snap.consensusDirection === "bullish" ? "text-green-500" : snap.consensusDirection === "bearish" ? "text-red-500" : "text-amber-500"}>
                          AI {snap.sentimentLabel}
                        </span>
                      )}
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5 ml-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-3"
                          disabled={!livePrice}
                          onClick={async () => {
                            if (livePrice) { await closeTrade(trade.id, livePrice); refetch(); }
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Close
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={async () => {
                            if (confirm("Delete this trade?")) await deleteTrade(trade.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Trade History */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-500" />
          Trade History
        </h2>
        {closedTrades.length === 0 ? (
          <Card className="border border-dashed border-border">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No closed trades yet. Your history will appear here once your first trade closes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {closedTrades.slice(0, 50).map((trade) => {
              const isWin = (trade.result_pnl ?? 0) > 0;
              return (
                <Card key={trade.id} className={`border ${isWin ? "border-green-500/20" : "border-red-500/20"}`}>
                  <CardContent className="py-3 px-4 space-y-2">
                    {/* Header: symbol + side + P/L */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/market/${encodeURIComponent(trade.symbol)}`} className="font-bold text-sm hover:underline">
                          {trade.symbol}
                        </Link>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            trade.side === "long"
                              ? "text-green-500 border-green-500/30"
                              : "text-red-500 border-red-500/30"
                          }`}
                        >
                          {trade.side === "long" ? (
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 mr-0.5" />
                          )}
                          {trade.side === "long" ? "BULLISH" : "BEARISH"}
                        </Badge>
                      </div>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          isWin ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {trade.result_pnl !== undefined ? (
                          <>
                            {formatPnl(trade.result_pnl)}{" "}
                            <span className="opacity-70">({formatDollarPnl(trade.result_pnl)})</span>
                          </>
                        ) : "—"}
                      </span>
                    </div>

                    {/* Price details grid */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Entry</span>
                        <span className="font-medium tabular-nums">
                          {getPriceDisplay(trade.entry_price)}
                        </span>
                      </div>
                      <div>
                        <span className="text-red-500 block">SL</span>
                        <span className="font-medium tabular-nums">
                          {getPriceDisplay(trade.sl_price)}
                        </span>
                      </div>
                      <div>
                        <span className="text-green-500 block">TP</span>
                        <span className="font-medium tabular-nums">
                          {getPriceDisplay(trade.tp_price)}
                        </span>
                      </div>
                      <div>
                        <span className={`block ${isWin ? "text-green-500" : "text-red-500"}`}>Close</span>
                        <span className="font-medium tabular-nums">
                          {trade.close_price ? getPriceDisplay(trade.close_price) : "—"}
                        </span>
                      </div>
                    </div>

                    {/* AI Journal Review */}
                    <button
                      onClick={() => fetchReview(trade)}
                      className="w-full flex items-center justify-between rounded-md bg-muted/40 hover:bg-muted/70 px-2.5 py-1.5 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5" />
                        AI Review
                      </span>
                      {journalState[trade.id]?.loading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : journalState[trade.id]?.open ? (
                        <ChevronUp className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    {journalState[trade.id]?.open && journalState[trade.id]?.review && (
                      <div className={`rounded-md px-3 py-2.5 text-[11px] leading-relaxed ${
                        isWin
                          ? "bg-green-500/5 border border-green-500/20 text-green-700 dark:text-green-300"
                          : "bg-red-500/5 border border-red-500/20 text-red-700 dark:text-red-300"
                      }`}>
                        {journalState[trade.id].review}
                      </div>
                    )}

                    {/* Footer: AI direction + date + delete */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/20">
                      <div className="flex items-center gap-2">
                        {trade.analysis_snapshot ? (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span>AI:</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                trade.analysis_snapshot.consensusDirection === "bullish"
                                  ? "text-green-500 border-green-500/30"
                                  : trade.analysis_snapshot.consensusDirection === "bearish"
                                  ? "text-red-500 border-red-500/30"
                                  : "text-amber-500 border-amber-500/30"
                              }`}
                            >
                              {trade.analysis_snapshot.consensusDirection}
                            </Badge>
                          </div>
                        ) : null}
                        <span className="text-[10px] text-muted-foreground">
                          {trade.closed_at
                            ? new Date(trade.closed_at).toLocaleDateString("en-US", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm("Delete this trade from history?")) {
                            await deleteTrade(trade.id);
                          }
                        }}
                        className="text-muted-foreground/40 hover:text-red-500 transition-colors"
                        title="Delete trade"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center">
        This is an educational simulator using virtual funds. No real money is used.
        Past results do not guarantee future performance.
      </p>
    </div>
  );
}
