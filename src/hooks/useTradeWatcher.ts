"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PaperTrade } from "@/types/simulator";
import type { MarketPrice } from "@/types/market";

// Check if forex markets are open (Sun 22:00 – Fri 22:00 GMT)
function isMarketOpen(): boolean {
  const now = new Date();
  const d = now.getUTCDay(), h = now.getUTCHours();
  if (d === 6) return false;
  if (d === 0 && h < 22) return false;
  if (d === 5 && h >= 22) return false;
  return true;
}

interface TradeWatcherProps {
  openTrades: PaperTrade[];
  refreshMs: number;
  closeTrade: (tradeId: string, closePrice: number) => Promise<boolean>;
  onTradeClosed?: (trade: PaperTrade, closePrice: number, pnl: number) => void;
  /** WebSocket prices from useEodhdWebSocket — avoids REST API calls */
  wsPrices?: Record<string, MarketPrice>;
}

async function fetchCurrentPrices(
  symbols: string[]
): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};

  const prices: Record<string, number> = {};

  // Fetch prices for each unique symbol
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const res = await fetch(
          `/api/market-data?symbol=${encodeURIComponent(sym)}&type=quote`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.data?.price) {
          prices[sym] = json.data.price;
        }
      } catch {
        // Skip failed fetches
      }
    })
  );

  return prices;
}

export function useTradeWatcher({
  openTrades,
  refreshMs,
  closeTrade,
  onTradeClosed,
  wsPrices,
}: TradeWatcherProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkingRef = useRef(false);

  const checkTrades = useCallback(async () => {
    if (checkingRef.current || openTrades.length === 0) return;
    checkingRef.current = true;

    try {
      const uniqueSymbols = [...new Set(openTrades.map((t) => t.symbol))];

      // Use WebSocket prices if available, otherwise fall back to REST
      let prices: Record<string, number> = {};
      if (wsPrices && Object.keys(wsPrices).length > 0) {
        for (const sym of uniqueSymbols) {
          if (wsPrices[sym]?.price) {
            prices[sym] = wsPrices[sym].price;
          }
        }
        // Fetch any missing symbols via REST
        const missing = uniqueSymbols.filter((s) => !prices[s]);
        if (missing.length > 0) {
          const restPrices = await fetchCurrentPrices(missing);
          prices = { ...prices, ...restPrices };
        }
      } else {
        prices = await fetchCurrentPrices(uniqueSymbols);
      }

      for (const trade of openTrades) {
        const currentPrice = prices[trade.symbol];
        if (!currentPrice) continue;

        let shouldClose = false;
        let closePrice = currentPrice;

        if (trade.side === "long") {
          if (currentPrice <= trade.sl_price) {
            shouldClose = true;
            closePrice = trade.sl_price;
          } else if (currentPrice >= trade.tp_price) {
            shouldClose = true;
            closePrice = trade.tp_price;
          }
        } else {
          // short
          if (currentPrice >= trade.sl_price) {
            shouldClose = true;
            closePrice = trade.sl_price;
          } else if (currentPrice <= trade.tp_price) {
            shouldClose = true;
            closePrice = trade.tp_price;
          }
        }

        if (shouldClose) {
          const pnl =
            trade.side === "long"
              ? ((closePrice - trade.entry_price) / trade.entry_price) * 100
              : ((trade.entry_price - closePrice) / trade.entry_price) * 100;

          const success = await closeTrade(trade.id, closePrice);
          if (success && onTradeClosed) {
            onTradeClosed(trade, closePrice, Math.round(pnl * 100) / 100);
          }
        }
      }
    } finally {
      checkingRef.current = false;
    }
  }, [openTrades, closeTrade, onTradeClosed, wsPrices]);

  // Check on mount (page load)
  useEffect(() => {
    checkTrades();
  }, [checkTrades]);

  // Live monitoring interval
  useEffect(() => {
    if (openTrades.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (isMarketOpen()) checkTrades();
    }, refreshMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkTrades, refreshMs, openTrades.length]);

  return { checkTrades };
}
