"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MarketPrice } from "@/types/market";
import { MARKETS } from "@/lib/market/symbols";
import { useEodhdWebSocket } from "./useEodhdWebSocket";

// Check if any major market session is currently open (GMT-based)
// Forex trades Sun 22:00 GMT – Fri 22:00 GMT
function isAnyMarketOpen(): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat
  const utcHour = now.getUTCHours();

  // Saturday: always closed
  if (utcDay === 6) return false;
  // Sunday: closed until 22:00 GMT (Sydney open)
  if (utcDay === 0 && utcHour < 22) return false;
  // Friday: closed after 22:00 GMT
  if (utcDay === 5 && utcHour >= 22) return false;

  return true;
}

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
  // Preserve change/changePercent from REST if WebSocket sends 0
  useEffect(() => {
    if (Object.keys(ws.prices).length > 0) {
      setPrices((prev) => {
        const merged = { ...prev };
        for (const [sym, wsPrice] of Object.entries(ws.prices)) {
          const existing = prev[sym];
          merged[sym] = {
            ...existing,
            ...wsPrice,
            // Keep REST change values if WS sends 0/undefined
            change: wsPrice.change || existing?.change || 0,
            changePercent: wsPrice.changePercent || existing?.changePercent || 0,
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
      if (isAnyMarketOpen()) {
        fetchPrices();
      }
    }, actualInterval);

    return () => clearInterval(interval);
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
