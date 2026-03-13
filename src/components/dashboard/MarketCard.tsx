import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MarketCategory } from "@/types/market";
import { CATEGORY_COLORS } from "@/lib/market/symbols";

interface MarketCardProps {
  symbol: string;
  name: string;
  icon: string;
  emoji?: string;
  category?: MarketCategory;
  price?: number;
  change?: number;
  changePercent?: number;
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
}: MarketCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const hasData = price !== undefined && price > 0;
  const colors = category ? CATEGORY_COLORS[category] : null;

  return (
    <Link href={`/dashboard/market/${encodeURIComponent(symbol)}`}>
      <Card className={cn("group border border-border bg-card transition-all hover:bg-accent", colors ? `border-l-4 ${colors.border}` : "")}>
        <CardContent className="p-4">
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
                <p className="text-xs text-muted-foreground">{symbol}</p>
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
                {changePercent !== undefined
                  ? `${isPositive ? "+" : ""}${changePercent.toFixed(2)}%`
                  : `${isPositive ? "+" : ""}${change.toFixed(2)}`}
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
                    {change.toFixed(2)}
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
  const prefix = getCurrencyPrefix(symbol);
  if (symbol.includes("JPY")) {
    return `${prefix}${price.toFixed(3)}`;
  }
  if (symbol === "SPX" || symbol === "IXIC") {
    return `${prefix}${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  // Forex majors with 4-5 decimal places
  if (symbol.includes("/") && !symbol.includes("JPY")) {
    return `${prefix}${price.toFixed(price < 10 ? 5 : 4)}`;
  }
  return `${prefix}${price.toFixed(2)}`;
}
