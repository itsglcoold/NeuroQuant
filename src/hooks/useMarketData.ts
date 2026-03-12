"use client";

import { useState, useEffect, useCallback } from "react";
import { MarketPrice } from "@/types/market";
import { MARKETS } from "@/lib/market/symbols";

export function useMarketData(refreshInterval = 60000) {
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const symbols = MARKETS.map((m) => m.symbol).join(",");
      const res = await fetch(`/api/market-data?symbols=${encodeURIComponent(symbols)}&type=quote`);

      if (!res.ok) throw new Error("Failed to fetch prices");

      const { data } = await res.json();

      if (Array.isArray(data)) {
        const priceMap: Record<string, MarketPrice> = {};
        for (const price of data) {
          priceMap[price.symbol] = price;
        }
        setPrices(priceMap);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrices();

    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrices, refreshInterval]);

  return { prices, loading, error, refetch: fetchPrices };
}
