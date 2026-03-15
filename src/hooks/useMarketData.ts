"use client";

import { useState, useEffect, useCallback } from "react";
import { MarketPrice } from "@/types/market";
import { MARKETS } from "@/lib/market/symbols";

// Check if any major market session is currently open (UTC-based)
// Forex trades Sun 21:00 UTC – Fri 21:00 UTC
function isAnyMarketOpen(): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat
  const utcHour = now.getUTCHours();

  // Saturday: always closed
  if (utcDay === 6) return false;
  // Sunday: closed until 21:00 UTC (Sydney open)
  if (utcDay === 0 && utcHour < 21) return false;
  // Friday: closed after 21:00 UTC
  if (utcDay === 5 && utcHour >= 21) return false;

  return true;
}

export function useMarketData(refreshInterval = 60000) {
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const symbols = MARKETS.map((m) => m.symbol).join(",");
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
        setPrices(priceMap);
      }

      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Always fetch once on mount to show latest data
    fetchPrices();

    // Only poll when markets are open; check every interval
    const interval = setInterval(() => {
      if (isAnyMarketOpen()) {
        fetchPrices();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchPrices, refreshInterval]);

  return { prices, loading, error, latency, lastUpdated, refetch: fetchPrices };
}
