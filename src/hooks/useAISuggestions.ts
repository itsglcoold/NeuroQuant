"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UserTier } from "@/hooks/useUsageTracking";
import type { MarketSuggestion } from "@/types/analysis";

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes (server caches 30 min)

export function useAISuggestions(tier: UserTier) {
  const [suggestions, setSuggestions] = useState<MarketSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (tier === "free") {
      setSuggestions([]);
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/analysis/suggestions?tier=${tier}`, {
        signal: controller.signal,
      });

      if (res.status === 403) {
        setSuggestions([]);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch suggestions");
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      // Don't show error for aborted requests
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [tier]);

  // Fetch on mount and on tier change
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Auto-refresh every 5 minutes for pro/premium
  useEffect(() => {
    if (tier === "free") return;

    const interval = setInterval(fetchSuggestions, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [tier, fetchSuggestions]);

  // Re-fetch when user returns from lock screen / tab switch
  useEffect(() => {
    if (tier === "free") return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        // Small delay to let network reconnect after wake
        setTimeout(fetchSuggestions, 500);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [tier, fetchSuggestions]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { suggestions, loading, error, lastUpdated, refetch: fetchSuggestions };
}
