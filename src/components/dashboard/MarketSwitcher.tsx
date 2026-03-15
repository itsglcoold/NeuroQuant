"use client";

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { MARKETS, MARKET_CATEGORIES, CATEGORY_COLORS } from "@/lib/market/symbols";
import { MarketCategory } from "@/types/market";

interface MarketSwitcherProps {
  currentSymbol: string;
}

const CATEGORY_ORDER: MarketCategory[] = Object.keys(MARKET_CATEGORIES) as MarketCategory[];

const SHORT_NAMES: Record<string, string> = {
  "XAU/USD": "Gold",
  "XAG/USD": "Silver",
  "CL": "Oil",
  "SPX": "S&P",
  "IXIC": "NASDAQ",
  "DXY": "DXY",
};

export function MarketSwitcher({ currentSymbol }: MarketSwitcherProps) {
  const activeRef = useRef<HTMLAnchorElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll the active item into view on mount / symbol change
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const scrollLeft = active.offsetLeft - container.offsetWidth / 2 + active.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "instant" });
    }
  }, [currentSymbol]);

  return (
    <div ref={containerRef} className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
      {CATEGORY_ORDER.map((category) => {
        const markets = MARKETS.filter((m) => m.category === category);
        const colors = CATEGORY_COLORS[category];

        return (
          <div key={category} className="flex items-center gap-1">
            {/* Category label */}
            <span className={`hidden sm:inline-block px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${colors.text} opacity-70`}>
              {MARKET_CATEGORIES[category].label}
            </span>

            {/* Market buttons */}
            {markets.map((market) => {
              const isActive = market.symbol === currentSymbol;
              return (
                <Link
                  key={market.symbol}
                  ref={isActive ? activeRef : undefined}
                  prefetch={false}
                  href={`/dashboard/market/${encodeURIComponent(market.symbol)}`}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? `${colors.bg} ${colors.text} ring-1 ring-current/20`
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span className="text-sm">{market.emoji}</span>
                  <span>{SHORT_NAMES[market.symbol] || market.name.split(" ")[0]}</span>
                </Link>
              );
            })}

            {/* Separator */}
            {category !== CATEGORY_ORDER[CATEGORY_ORDER.length - 1] && (
              <div className="mx-1 h-4 w-px bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
