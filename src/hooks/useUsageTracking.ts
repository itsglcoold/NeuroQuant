"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserTier = "free" | "pro" | "premium";

const TIER_LIMITS: Record<UserTier, { analysesPerDay: number; refreshMs: number }> = {
  free: { analysesPerDay: 3, refreshMs: 60000 },       // 60s — decent for free
  pro: { analysesPerDay: 50, refreshMs: 30000 },       // 30s — fast for traders
  premium: { analysesPerDay: Infinity, refreshMs: 15000 }, // 15s — near real-time
};

// Features locked behind tiers
export const FEATURE_ACCESS: Record<string, UserTier> = {
  "ai-analysis": "free",
  "chart-upload": "pro",
  "ai-chat": "free",
  "triple-ai": "pro",
  "custom-alerts": "pro",
  "ai-suggestions": "pro",
  "historical-reports": "premium",
  "api-access": "premium",
  "simulator": "free",
  "simulator-autofill": "pro",
  "price-alerts": "pro",
  "watchlist": "free",
  "consensus-history": "free",
  "analytics": "free",
};

interface UsageData {
  date: string;
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
  const [tier, setTier] = useState<UserTier>(() => {
    if (typeof window === "undefined") return "free";
    return (localStorage.getItem(TIER_KEY) as UserTier) || "free";
  });
  const [tierLoaded, setTierLoaded] = useState(false);

  const [usage, setUsage] = useState<UsageData>(loadUsage);

  // Fetch tier from Supabase profiles on mount + listen for auth changes
  useEffect(() => {
    const supabase = createClient();

    async function fetchTier() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setTier("free");
          localStorage.removeItem(TIER_KEY);
          setTierLoaded(true);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single();

        if (!profile) {
          // First login — create profile with free tier
          await supabase.from("profiles").insert({
            id: user.id,
            subscription_tier: "free",
          });
        }

        // Always use DB value; never trust localStorage when logged in.
        // Falls back to "free" if no profile row exists yet.
        const dbTier = (profile?.subscription_tier as UserTier) || "free";
        setTier(dbTier);
        localStorage.setItem(TIER_KEY, dbTier);
      } catch {
        // Best-effort — fall back to localStorage value
      } finally {
        setTierLoaded(true);
      }
    }

    fetchTier();

    // Reset tier immediately when user signs out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setTier("free");
        localStorage.removeItem(TIER_KEY);
      } else if (event === "SIGNED_IN") {
        fetchTier();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    tierLoaded,
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
