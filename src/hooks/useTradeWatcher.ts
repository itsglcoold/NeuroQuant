"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PaperTrade } from "@/types/simulator";

interface TradeWatcherProps {
  openTrades: PaperTrade[];
  refreshMs: number;
  closeTrade: (tradeId: string, closePrice: number) => Promise<boolean>;
  onTradeClosed?: (trade: PaperTrade, closePrice: number, pnl: number) => void;
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
}: TradeWatcherProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkingRef = useRef(false);

  const checkTrades = useCallback(async () => {
    if (checkingRef.current || openTrades.length === 0) return;
    checkingRef.current = true;

    try {
      const uniqueSymbols = [...new Set(openTrades.map((t) => t.symbol))];
      const prices = await fetchCurrentPrices(uniqueSymbols);

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
  }, [openTrades, closeTrade, onTradeClosed]);

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

    intervalRef.current = setInterval(checkTrades, refreshMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkTrades, refreshMs, openTrades.length]);

  return { checkTrades };
}
