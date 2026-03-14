"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UserTier } from "@/hooks/useUsageTracking";
import type { MarketSuggestion } from "@/types/analysis";

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes (server caches 30 min)

export function useAISuggestions(tier: UserTier) {
  const [suggestions, setSuggestions] = useState<MarketSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const hasFetchedOnce = useRef(false);

  const fetchSuggestions = useCallback(
    async (force = false) => {
      if (tier === "free") {
        setSuggestions([]);
        return;
      }

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // First load: show skeleton loading
      // Manual refresh: show refreshing spinner (keep tiles visible)
      if (!hasFetchedOnce.current) {
        setLoading(true);
      }
      if (force) {
        setRefreshing(true);
      }
      setError(null);

      try {
        const url = force
          ? `/api/analysis/suggestions?tier=${tier}&force=true`
          : `/api/analysis/suggestions?tier=${tier}`;

        const res = await fetch(url, { signal: controller.signal });

        if (res.status === 403) {
          setSuggestions([]);
          return;
        }

        if (!res.ok) {
          if (suggestions.length > 0) return;
          throw new Error("Failed to fetch suggestions");
        }

        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setLastUpdated(
          data.generatedAt ? new Date(data.generatedAt) : new Date()
        );
        setIsStale(data._stale === true);
        setError(null);
        hasFetchedOnce.current = true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (suggestions.length === 0) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tier]
  );

  // Fetch on mount and on tier change (no force — use cache)
  useEffect(() => {
    fetchSuggestions(false);
  }, [fetchSuggestions]);

  // Auto-refresh every 5 minutes for pro/premium (no force — use cache)
  useEffect(() => {
    if (tier === "free") return;
    const interval = setInterval(() => fetchSuggestions(false), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [tier, fetchSuggestions]);

  // Re-fetch when user returns from lock screen / tab switch
  useEffect(() => {
    if (tier === "free") return;
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        setTimeout(() => fetchSuggestions(false), 500);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [tier, fetchSuggestions]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return {
    suggestions,
    loading,
    refreshing,
    error,
    lastUpdated,
    isStale,
    // Manual refresh always forces a fresh scan
    refetch: () => fetchSuggestions(true),
  };
}
