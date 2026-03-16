"use client";

import { MARKETS, MARKET_CATEGORIES, CATEGORY_COLORS, getSymbolTradingStyle } from "@/lib/market/symbols";
import { MarketCard } from "@/components/dashboard/MarketCard";
import { MarketCategory } from "@/types/market";
import { useMarketData } from "@/hooks/useMarketData";
import { SessionTimes } from "@/components/dashboard/SessionTimes";
import { Activity, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { AISuggestions } from "@/components/dashboard/AISuggestions";
import { useMemo, useState, useEffect } from "react";

/** Check if any major forex/commodity market is currently open */
function getMarketStatus() {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat
  const utcHour = now.getUTCHours();

  // Forex market: Sun 22:00 GMT → Fri 22:00 GMT
  if (utcDay === 6) return { open: false, label: "Closed (weekend)" };
  if (utcDay === 0 && utcHour < 22) return { open: false, label: "Closed (weekend)" };
  if (utcDay === 5 && utcHour >= 22) return { open: false, label: "Closed (weekend)" };

  // Determine which session(s) are active
  const sessions: string[] = [];
  // Sydney: 22:00–07:00 GMT
  if (utcHour >= 22 || utcHour < 7) sessions.push("Sydney");
  // Tokyo: 00:00–09:00 GMT
  if (utcHour >= 0 && utcHour < 9) sessions.push("Tokyo");
  // London: 08:00–16:00 GMT
  if (utcHour >= 8 && utcHour < 16) sessions.push("London");
  // New York: 13:00–22:00 GMT
  if (utcHour >= 13 && utcHour < 22) sessions.push("New York");

  if (sessions.length === 1) {
    return { open: true, label: `${sessions[0]} session is open` };
  }
  if (sessions.length > 1) {
    return { open: true, label: `${sessions.join(" & ")} sessions are open` };
  }
  return { open: true, label: "Markets are open" };
}

function useMarketStatus() {
  const [status, setStatus] = useState(getMarketStatus);

  // Recalculate every 60 seconds so session changes are reflected
  useEffect(() => {
    const interval = setInterval(() => setStatus(getMarketStatus()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return status;
}

export default function DashboardPage() {
  const { prices, loading, error, latency, lastUpdated, refetch, wsConnected } = useMarketData(60000);
  const { tier } = useUsageTracking();
  const marketStatus = useMarketStatus();

  // Only show "Refresh Prices" button when it's useful:
  // - There's a connection error
  // - WebSocket is disconnected AND data is older than 2 minutes
  const dataAge = lastUpdated ? (Date.now() - lastUpdated.getTime()) / 1000 : Infinity;
  const showRefreshButton = !!error || (!wsConnected && dataAge > 120) || (!lastUpdated && !loading);

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
        {showRefreshButton && (
          <button
            onClick={() => refetch()}
            disabled={loading}
            title="Refresh all market prices"
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              loading && "pointer-events-none opacity-50"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh Prices
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2.5">
        <div className="relative flex h-2 w-2 items-center justify-center">
          {marketStatus.open && (
            <span className="absolute h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={cn(
            "relative h-2 w-2 rounded-full",
            marketStatus.open ? "bg-emerald-500" : "bg-red-500"
          )} />
        </div>
        <span className="text-xs text-foreground/80">{marketStatus.label}</span>
        <span className="text-xs text-muted-foreground">|</span>
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {error ? "Connection error — retrying…" : wsConnected ? "WebSocket streaming" : "Real-time data updating"}
        </span>
        {latency !== null && !error && (
          <>
            <span className="text-xs text-muted-foreground">|</span>
            <span className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              latency < 500 ? "text-emerald-600 dark:text-emerald-400" :
              latency < 1500 ? "text-amber-600 dark:text-amber-400" :
              "text-orange-600 dark:text-orange-400"
            )}>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                latency < 500 ? "bg-emerald-500" :
                latency < 1500 ? "bg-amber-500" :
                "bg-orange-500"
              )} />
              {latency}ms
            </span>
          </>
        )}
        {lastUpdated && !error && (
          <>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground/60">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          </>
        )}
      </div>

      {/* Market sessions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Market Sessions
        </h2>
        <SessionTimes />
      </section>

      {/* AI Market Suggestions */}
      <AISuggestions tier={tier} />

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
                    tradingStyle={getSymbolTradingStyle(market.symbol)}
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
