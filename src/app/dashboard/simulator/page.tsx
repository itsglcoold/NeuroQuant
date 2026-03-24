"use client";

import { useState } from "react";
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
    refetch,
  } = useSimulator(tier);

  const [closedNotifications, setClosedNotifications] = useState<
    { symbol: string; pnl: number }[]
  >([]);

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
      <div>
        <h1 className="text-2xl font-bold">Trading Simulator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paper trading based on AI analyses —{" "}
          {dailyLimit === Infinity
            ? "Unlimited trades"
            : `${tradesRemaining}/${dailyLimit} trades today`}
        </p>
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

      {/* Active Trades */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500" />
          Active Trades
        </h2>
        {openTrades.length === 0 ? (
          <Card className="border border-dashed border-border">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No active trades. Go to a{" "}
                <Link href="/dashboard" className="text-blue-500 hover:underline font-medium">
                  market page
                </Link>{" "}
                to run an analysis and open a trade.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {openTrades.map((trade) => {
              const livePrice = wsPrices[trade.symbol]?.price || null;
              const livePnl = livePrice
                ? calcLivePnl(trade, livePrice)
                : null;

              return (
                <Card key={trade.id} className="border border-border/60">
                  <CardContent className="py-3 px-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{trade.symbol}</span>
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
                      </div>
                      {livePnl !== null && (
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            livePnl >= 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {formatPnl(livePnl)}{" "}
                          <span className="opacity-70">({formatDollarPnl(livePnl)})</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
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
                    </div>

                    {/* AI Snapshot */}
                    {trade.analysis_snapshot && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
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
                          {trade.analysis_snapshot.sentimentLabel}
                        </Badge>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7"
                        onClick={async () => {
                          if (livePrice) {
                            await closeTrade(trade.id, livePrice);
                            refetch();
                          }
                        }}
                        disabled={!livePrice}
                      >
                        Close Trade
                      </Button>
                      <Link href={`/dashboard/market/${encodeURIComponent(trade.symbol)}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-7">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={async () => {
                          if (confirm("Delete this trade?")) {
                            await deleteTrade(trade.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
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
