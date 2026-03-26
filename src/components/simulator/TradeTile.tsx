"use client";

/**
 * TradeTile — expandable accordion tile for a single open paper trade.
 * Used on both the market detail page and the simulator page.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { PaperTrade } from "@/types/simulator";

// ---------------------------------------------------------------------------
// Price formatting helpers (duplicated locally to keep component self-contained)
// ---------------------------------------------------------------------------

function getCurrencyPrefix(symbol: string): string {
  if (["XAU/USD", "XAG/USD", "CL", "SPX", "IXIC", "DXY"].includes(symbol)) return "$";
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

function getPriceDecimals(price: number): number {
  return price > 100 ? 2 : 4;
}

function fmt(price: number): string {
  return price.toFixed(getPriceDecimals(price));
}

function holdingTime(openedAt: string): string {
  const ms = Date.now() - new Date(openedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function regimeLabel(regime: string): string {
  if (regime === "trending") return "Trending";
  if (regime === "ranging") return "Ranging";
  if (regime === "choppy") return "Choppy";
  return regime;
}

function regimeColor(regime: string): string {
  if (regime === "trending") return "text-green-500";
  if (regime === "ranging") return "text-blue-500";
  return "text-amber-500";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TradeTileProps {
  trade: PaperTrade;
  currentPrice: number | null;
  virtualBalance: number;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: (id: string, price: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Show a link icon to the market page (used on simulator page) */
  showSymbolLink?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradeTile({
  trade,
  currentPrice,
  virtualBalance,
  isExpanded,
  onToggle,
  onClose,
  onDelete,
  showSymbolLink = false,
}: TradeTileProps) {
  const prefix = getCurrencyPrefix(trade.symbol);
  const decimals = getPriceDecimals(trade.entry_price);

  const pnlPct = currentPrice
    ? trade.side === "long"
      ? ((currentPrice - trade.entry_price) / trade.entry_price) * 100
      : ((trade.entry_price - currentPrice) / trade.entry_price) * 100
    : null;

  const pnlDollar = pnlPct !== null ? (virtualBalance * pnlPct) / 100 : null;
  const isProfit = pnlPct !== null && pnlPct >= 0;

  const distToSl = currentPrice
    ? trade.side === "long"
      ? ((currentPrice - trade.sl_price) / trade.sl_price) * 100
      : ((trade.sl_price - currentPrice) / trade.sl_price) * 100
    : null;

  const distToTp = currentPrice
    ? trade.side === "long"
      ? ((trade.tp_price - currentPrice) / currentPrice) * 100
      : ((currentPrice - trade.tp_price) / currentPrice) * 100
    : null;

  const snap = trade.analysis_snapshot;

  // R:R computed from prices if not stored in snapshot
  const rrRatio = snap?.rrRatio ??
    Math.abs(trade.tp_price - trade.entry_price) / Math.abs(trade.sl_price - trade.entry_price);

  const borderColor = isProfit ? "border-green-500/30" : "border-red-500/30";
  const bgColor     = isProfit ? "bg-green-500/5"      : "bg-red-500/5";

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${borderColor}`}>
      {/* Collapsed header */}
      <button
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30 ${bgColor}`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {showSymbolLink ? (
            <Link
              href={`/dashboard/market/${encodeURIComponent(trade.symbol)}`}
              className="font-bold text-sm hover:text-blue-500 hover:underline transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {trade.symbol}
            </Link>
          ) : null}
          {trade.side === "long"
            ? <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
            : <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
          <span className="text-sm font-semibold">{trade.side === "long" ? "BUY" : "SELL"}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            @ {prefix}{trade.entry_price.toFixed(decimals)}
          </span>
          {pnlPct !== null && (
            <Badge
              variant="outline"
              className={`text-[10px] tabular-nums ${
                isProfit
                  ? "border-green-500/40 text-green-600 dark:text-green-400"
                  : "border-red-500/40 text-red-600 dark:text-red-400"
              }`}
            >
              {isProfit ? "+" : ""}{pnlPct.toFixed(2)}%
              {pnlDollar !== null && (
                <span className="ml-1 opacity-80">
                  ({pnlDollar >= 0 ? "+" : "-"}${Math.abs(pnlDollar).toFixed(2)})
                </span>
              )}
            </Badge>
          )}
        </div>
        {isExpanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${isProfit ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>

          {/* Entry / SL / TP grid */}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-background/60 border border-border p-2">
              <p className="text-muted-foreground font-medium">Entry</p>
              <p className="font-bold tabular-nums mt-0.5">{prefix}{fmt(trade.entry_price)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{holdingTime(trade.created_at)} ago</p>
            </div>
            <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-2">
              <p className="text-red-500/70 font-medium">Stop-Loss</p>
              <p className="font-bold tabular-nums text-red-600 dark:text-red-400 mt-0.5">{prefix}{fmt(trade.sl_price)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {distToSl !== null
                  ? distToSl > 0 ? `${distToSl.toFixed(2)}% away` : "⚠ breached"
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-2">
              <p className="text-green-500/70 font-medium">Take-Profit</p>
              <p className="font-bold tabular-nums text-green-600 dark:text-green-400 mt-0.5">{prefix}{fmt(trade.tp_price)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {distToTp !== null
                  ? distToTp > 0 ? `${distToTp.toFixed(2)}% away` : "🎯 reached"
                  : "—"}
              </p>
            </div>
          </div>

          {/* Trade metadata row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>R:R <span className="text-foreground font-semibold">1:{rrRatio.toFixed(1)}</span></span>
            {snap?.riskScore !== undefined && (
              <span>
                Risk Score{" "}
                <span className={`font-semibold ${
                  snap.riskScore >= 7 ? "text-green-500"
                  : snap.riskScore >= 4 ? "text-amber-500"
                  : "text-red-500"
                }`}>{snap.riskScore}/10</span>
              </span>
            )}
            {snap?.atrPips !== undefined && snap.atrLabel && (
              <span>ATR <span className="text-foreground font-semibold">{snap.atrPips}{snap.atrLabel}</span></span>
            )}
            {snap?.regime && (
              <span>
                Regime{" "}
                <span className={`font-semibold ${regimeColor(snap.regime)}`}>
                  {regimeLabel(snap.regime)}
                </span>
              </span>
            )}
            {snap && (
              <span>
                AI{" "}
                <span className={`font-semibold ${
                  snap.consensusDirection === "bullish" ? "text-green-500"
                  : snap.consensusDirection === "bearish" ? "text-red-500"
                  : "text-amber-500"
                }`}>{snap.sentimentLabel}</span>
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (currentPrice) await onClose(trade.id, currentPrice);
              }}
              disabled={!currentPrice}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:border-red-500/50 hover:text-red-500 transition-colors disabled:opacity-40"
            >
              <X className="h-3 w-3" />
              Close trade
            </button>
            <button
              onClick={async () => {
                if (confirm("Delete this trade?")) await onDelete(trade.id);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-red-500/70 hover:text-red-500 hover:border-red-500/50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
            {showSymbolLink && (
              <Link
                href={`/dashboard/market/${encodeURIComponent(trade.symbol)}`}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-blue-500 hover:border-blue-500/50 transition-colors ml-auto"
              >
                <ExternalLink className="h-3 w-3" />
                Market page
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
