"use client";

import { MARKETS, MARKET_CATEGORIES, CATEGORY_COLORS } from "@/lib/market/symbols";
import { MarketCard } from "@/components/dashboard/MarketCard";
import { MarketCategory } from "@/types/market";
import { useMarketData } from "@/hooks/useMarketData";
import { SessionTimes } from "@/components/dashboard/SessionTimes";
import { Activity, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { prices, loading, error, refetch } = useMarketData(60000);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Market Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live market data with AI-powered analysis. Click any market for
            detailed insights.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            loading && "pointer-events-none opacity-50"
          )}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2.5">
        <div className="relative flex h-2 w-2 items-center justify-center">
          <span className="absolute h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
        </div>
        <span className="text-xs text-foreground/80">Markets are open</span>
        <span className="text-xs text-muted-foreground">|</span>
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {error ? "Connection error — retrying…" : "Real-time data updating"}
        </span>
      </div>

      {/* Market sessions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Market Sessions
        </h2>
        <SessionTimes />
      </section>

      {/* Market cards by category */}
      {(
        Object.entries(MARKET_CATEGORIES) as [
          string,
          { label: string; description: string },
        ][]
      ).map(([categoryKey, category]) => {
        const categoryMarkets = MARKETS.filter(
          (m) => m.category === categoryKey
        );

        if (categoryMarkets.length === 0) return null;

        return (
          <section key={categoryKey}>
            <div className="mb-4 flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-full ${CATEGORY_COLORS[categoryKey as MarketCategory]?.dot}`} />
              <h2 className="text-lg font-semibold text-foreground">
                {category.label}
              </h2>
              <span className="text-sm text-muted-foreground">
                {category.description}
              </span>
            </div>
            <div className={cn(
              "grid gap-4",
              categoryMarkets.length === 1
                ? "grid-cols-1"
                : categoryMarkets.length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : categoryMarkets.length === 3
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}>
              {categoryMarkets.map((market) => {
                const priceData = prices[market.symbol];
                return (
                  <MarketCard
                    key={market.symbol}
                    symbol={market.symbol}
                    name={market.name}
                    icon={market.icon}
                    emoji={market.emoji}
                    category={market.category}
                    price={priceData?.price}
                    change={priceData?.change}
                    changePercent={priceData?.changePercent}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
