"use client";

import { useState, useEffect, useCallback } from "react";

// User tier — hardcoded to "free" for now until Stripe is integrated
export type UserTier = "free" | "pro" | "premium";

const TIER_LIMITS: Record<UserTier, { analysesPerDay: number; refreshMs: number }> = {
  free: { analysesPerDay: 3, refreshMs: 60000 },
  pro: { analysesPerDay: 50, refreshMs: 60000 }, // 60s for now, will be 5s later
  premium: { analysesPerDay: Infinity, refreshMs: 60000 }, // 60s for now, will be real-time later
};

// Features locked behind tiers
export const FEATURE_ACCESS: Record<string, UserTier> = {
  "ai-analysis": "free",       // available to all, but limited by count
  "chart-upload": "pro",
  "ai-chat": "free",           // available to all for now
  "triple-ai": "pro",
  "custom-alerts": "pro",      // not built yet
  "historical-reports": "premium", // not built yet
  "api-access": "premium",     // not built yet
};

interface UsageData {
  date: string;          // YYYY-MM-DD
  analysesUsed: number;
}

const STORAGE_KEY = "nq_usage";
const TIER_KEY = "nq_tier";

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function loadUsage(): UsageData {
  if (typeof window === "undefined") return { date: getTodayKey(), analysesUsed: 0 };

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: UsageData = JSON.parse(stored);
      // Reset if it's a new day
      if (parsed.date !== getTodayKey()) {
        return { date: getTodayKey(), analysesUsed: 0 };
      }
      return parsed;
    }
  } catch {
    // ignore
  }
  return { date: getTodayKey(), analysesUsed: 0 };
}

function saveUsage(data: UsageData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useUsageTracking() {
  const [tier] = useState<UserTier>(() => {
    if (typeof window === "undefined") return "free";
    return (localStorage.getItem(TIER_KEY) as UserTier) || "free";
  });

  const [usage, setUsage] = useState<UsageData>(loadUsage);

  // Sync usage to localStorage
  useEffect(() => {
    saveUsage(usage);
  }, [usage]);

  // Reset counter at midnight
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      setUsage({ date: getTodayKey(), analysesUsed: 0 });
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  }, [usage.date]);

  const limits = TIER_LIMITS[tier];
  const analysesRemaining = Math.max(0, limits.analysesPerDay - usage.analysesUsed);
  const analysesTotal = limits.analysesPerDay;
  const canRunAnalysis = analysesRemaining > 0;

  const consumeAnalysis = useCallback(() => {
    setUsage((prev) => ({
      ...prev,
      analysesUsed: prev.analysesUsed + 1,
    }));
  }, []);

  const canAccessFeature = useCallback(
    (feature: string): boolean => {
      const requiredTier = FEATURE_ACCESS[feature];
      if (!requiredTier) return true;
      const tierOrder: UserTier[] = ["free", "pro", "premium"];
      return tierOrder.indexOf(tier) >= tierOrder.indexOf(requiredTier);
    },
    [tier]
  );

  const getRequiredTier = (feature: string): UserTier => {
    return FEATURE_ACCESS[feature] || "free";
  };

  return {
    tier,
    usage,
    analysesRemaining,
    analysesTotal,
    canRunAnalysis,
    consumeAnalysis,
    canAccessFeature,
    getRequiredTier,
    refreshMs: limits.refreshMs,
  };
}
