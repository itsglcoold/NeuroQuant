"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MarketPrice } from "@/types/market";
import { MARKETS } from "@/lib/market/symbols";
import { useEodhdWebSocket } from "./useEodhdWebSocket";
import { isMarketOpen } from "@/lib/market/hours";

const ALL_SYMBOLS = MARKETS.map((m) => m.symbol);

export function useMarketData(refreshInterval = 60000) {
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const initialFetchDone = useRef(false);

  // ── WebSocket streaming (0 REST API calls) ──
  const ws = useEodhdWebSocket(ALL_SYMBOLS);

  // Merge WebSocket prices into state whenever they update
  // WS only provides reliable: price, high, low, timestamp
  // change/changePercent ALWAYS come from REST (EODHD WS dd/dc are unreliable, often 0)
  useEffect(() => {
    if (Object.keys(ws.prices).length > 0) {
      setPrices((prev) => {
        const merged = { ...prev };
        for (const [sym, wsPrice] of Object.entries(ws.prices)) {
          const existing = prev[sym];
          merged[sym] = {
            symbol: sym,
            price: wsPrice.price || existing?.price || 0,
            // NEVER use WS change values — REST is the source of truth for daily change
            change: existing?.change || 0,
            changePercent: existing?.changePercent || 0,
            // WS can update high/low if it tracks intraday extremes
            high: wsPrice.high && existing?.high
              ? Math.max(wsPrice.high, existing.high)
              : wsPrice.high || existing?.high || 0,
            low: wsPrice.low && existing?.low
              ? Math.min(wsPrice.low, existing.low)
              : wsPrice.low || existing?.low || 0,
            open: existing?.open || wsPrice.open || 0,
            previousClose: existing?.previousClose || wsPrice.previousClose || 0,
            timestamp: wsPrice.timestamp || existing?.timestamp || 0,
          };
        }
        return merged;
      });
      setLastUpdated(new Date());
      setLoading(false);
      setError(null);
    }
  }, [ws.prices]);

  // ── REST fallback: initial load + periodic refresh for symbols not on WS ──
  const fetchPrices = useCallback(async () => {
    try {
      const symbols = ALL_SYMBOLS.join(",");
      const start = performance.now();
      const res = await fetch(`/api/market-data?symbols=${encodeURIComponent(symbols)}&type=quote`);
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);

      if (!res.ok) throw new Error("Failed to fetch prices");

      const { data } = await res.json();

      if (Array.isArray(data)) {
        const priceMap: Record<string, MarketPrice> = {};
        for (const price of data) {
          priceMap[price.symbol] = price;
        }
        setPrices((prev) => ({ ...prev, ...priceMap }));
      }

      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Always fetch once on mount to get initial data (open/high/low/previousClose)
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchPrices();
    }

    // If WebSocket is connected, only poll REST every 5 minutes as backup
    // If WebSocket is not connected, poll REST at normal interval
    const actualInterval = ws.connected ? Math.max(refreshInterval, 300000) : refreshInterval;

    const interval = setInterval(() => {
      if (isMarketOpen()) {
        fetchPrices();
      }
    }, actualInterval);

    // Auto-refresh when user returns to the tab (e.g. after switching apps)
    // This ensures prices + change values are always fresh without manual buttons
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isMarketOpen()) {
        fetchPrices();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchPrices, refreshInterval, ws.connected]);

  return {
    prices,
    loading,
    error: ws.error || error,
    latency,
    lastUpdated,
    refetch: fetchPrices,
    wsConnected: ws.connected,
  };
}
