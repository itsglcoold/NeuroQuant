"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MarketCategory } from "@/types/market";
import { CATEGORY_COLORS } from "@/lib/market/symbols";

const STYLE_BADGE_COLORS: Record<string, string> = {
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
};

interface MarketCardProps {
  symbol: string;
  name: string;
  icon: string;
  emoji?: string;
  category?: MarketCategory;
  price?: number;
  change?: number;
  changePercent?: number;
  tradingStyle?: { key: string; label: string; badgeColor: string; timeframeFocus: string };
  isPinned?: boolean;
  onTogglePin?: (symbol: string) => void;
}

export function MarketCard({
  symbol,
  name,
  icon,
  emoji,
  category,
  price,
  change,
  changePercent,
  tradingStyle,
  isPinned,
  onTogglePin,
}: MarketCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const hasData = price !== undefined && price > 0;
  const colors = category ? CATEGORY_COLORS[category] : null;
  const styleParam = tradingStyle ? `?style=${tradingStyle.key}` : "";

  return (
    <Link href={`/dashboard/market/${encodeURIComponent(symbol)}${styleParam}`} prefetch={false}>
      <Card className={cn("group relative border border-border bg-card transition-all hover:bg-accent", colors ? `border-l-4 ${colors.border}` : "", isPinned ? "ring-1 ring-amber-400/30" : "")}>
        <CardContent className="p-4">
          {onTogglePin && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(symbol); }}
              className="absolute top-2 right-2 z-10 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
              title={isPinned ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star className={cn("h-3.5 w-3.5", isPinned ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </button>
          )}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-colors group-hover:bg-secondary", colors ? `${colors.bg}` : "bg-muted")}>
                {emoji ? (
                  <span className="text-lg">{emoji}</span>
                ) : (
                  <span className={cn("text-xs font-bold", colors ? colors.text : "text-muted-foreground")}>{icon}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{name}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground">{symbol}</p>
                  {tradingStyle && (
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none", STYLE_BADGE_COLORS[tradingStyle.badgeColor] || STYLE_BADGE_COLORS.blue)}>
                      {tradingStyle.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {hasData && change !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
                  isPositive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {changePercent !== undefined && typeof changePercent === "number"
                  ? `${isPositive ? "+" : ""}${changePercent.toFixed(2)}%`
                  : change !== undefined && typeof change === "number"
                    ? `${isPositive ? "+" : ""}${change.toFixed(2)}`
                    : "0.00"}
              </div>
            )}
          </div>

          <div className="mt-4">
            {hasData ? (
              <div className="flex items-end justify-between">
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatPrice(price, symbol)}
                </span>
                {change !== undefined && (
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {typeof change === "number" ? change.toFixed(2) : "0.00"}
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function getCurrencyPrefix(symbol: string): string {
  // USD-denominated assets
  if (["XAU/USD", "XAG/USD", "CL", "SPX", "IXIC", "DXY"].includes(symbol)) return "$";
  // Forex pairs — use the quote currency symbol
  if (symbol.includes("/")) {
    const quote = symbol.split("/")[1];
    if (quote === "USD") return "$";
    if (quote === "GBP") return "\u00A3";
    if (quote === "JPY") return "\u00A5";
    if (quote === "CHF") return "Fr ";
    if (quote === "CAD") return "C$";
    if (quote === "AUD") return "A$";
    if (quote === "NZD") return "NZ$";
    return "";
  }
  return "$";
}

function formatPrice(price: number, symbol: string): string {
  const p = typeof price === "number" && !isNaN(price) ? price : 0;
  const prefix = getCurrencyPrefix(symbol);
  if (symbol.includes("JPY")) {
    return `${prefix}${p.toFixed(3)}`;
  }
  if (symbol === "SPX" || symbol === "IXIC") {
    return `${prefix}${p.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  // Forex majors with 4-5 decimal places
  if (symbol.includes("/") && !symbol.includes("JPY")) {
    return `${prefix}${p.toFixed(p < 10 ? 5 : 4)}`;
  }
  return `${prefix}${p.toFixed(2)}`;
}
