"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PaperTrade,
  AnalysisSnapshot,
  SimulatorStats,
  SIMULATOR_LIMITS,
  INITIAL_VIRTUAL_BALANCE,
} from "@/types/simulator";
import type { UserTier } from "@/hooks/useUsageTracking";

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function useSimulator(tier: UserTier) {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch all trades on mount
  const fetchTrades = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setTrades([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("paper_trades")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setTrades((data as PaperTrade[]) || []);
    } catch (err) {
      console.error("Failed to fetch trades:", err);
      setError("Kon trades niet ophalen");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Count today's trades for limit check
  const todayTradeCount = trades.filter((t) => {
    const tradeDate = new Date(t.created_at).toISOString().split("T")[0];
    return tradeDate === getTodayKey();
  }).length;

  const dailyLimit = SIMULATOR_LIMITS[tier] ?? 3;
  const tradesRemaining = Math.max(0, dailyLimit - todayTradeCount);
  const canOpenTrade = tradesRemaining > 0;

  // Open a new trade
  const openTrade = useCallback(
    async (params: {
      symbol: string;
      side: "long" | "short";
      entryPrice: number;
      slPrice: number;
      tpPrice: number;
      analysisSnapshot?: AnalysisSnapshot;
    }): Promise<{ success: boolean; error?: string }> => {
      if (!canOpenTrade) {
        return {
          success: false,
          error: `Dagelijkse limiet bereikt (${dailyLimit} trades per dag)`,
        };
      }

      // Validate SL/TP
      if (params.side === "long") {
        if (params.slPrice >= params.entryPrice) {
          return { success: false, error: "Stop-Loss moet lager zijn dan de entry prijs (Long)" };
        }
        if (params.tpPrice <= params.entryPrice) {
          return { success: false, error: "Take-Profit moet hoger zijn dan de entry prijs (Long)" };
        }
      } else {
        if (params.slPrice <= params.entryPrice) {
          return { success: false, error: "Stop-Loss moet hoger zijn dan de entry prijs (Short)" };
        }
        if (params.tpPrice >= params.entryPrice) {
          return { success: false, error: "Take-Profit moet lager zijn dan de entry prijs (Short)" };
        }
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Je moet ingelogd zijn" };

        const { data, error: insertError } = await supabase
          .from("paper_trades")
          .insert({
            user_id: user.id,
            symbol: params.symbol,
            side: params.side,
            entry_price: params.entryPrice,
            sl_price: params.slPrice,
            tp_price: params.tpPrice,
            status: "open",
            analysis_snapshot: params.analysisSnapshot || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        setTrades((prev) => [data as PaperTrade, ...prev]);
        return { success: true };
      } catch (err) {
        console.error("Failed to open trade:", err);
        return { success: false, error: "Kon trade niet openen" };
      }
    },
    [supabase, canOpenTrade, dailyLimit]
  );

  // Close a trade manually or via watcher
  const closeTrade = useCallback(
    async (tradeId: string, closePrice: number): Promise<boolean> => {
      const trade = trades.find((t) => t.id === tradeId);
      if (!trade || trade.status === "closed") return false;

      const pnl =
        trade.side === "long"
          ? ((closePrice - trade.entry_price) / trade.entry_price) * 100
          : ((trade.entry_price - closePrice) / trade.entry_price) * 100;

      try {
        const { error: updateError } = await supabase
          .from("paper_trades")
          .update({
            status: "closed",
            close_price: closePrice,
            result_pnl: Math.round(pnl * 100) / 100,
            closed_at: new Date().toISOString(),
          })
          .eq("id", tradeId);

        if (updateError) throw updateError;

        setTrades((prev) =>
          prev.map((t) =>
            t.id === tradeId
              ? {
                  ...t,
                  status: "closed" as const,
                  close_price: closePrice,
                  result_pnl: Math.round(pnl * 100) / 100,
                  closed_at: new Date().toISOString(),
                }
              : t
          )
        );
        return true;
      } catch (err) {
        console.error("Failed to close trade:", err);
        return false;
      }
    },
    [supabase, trades]
  );

  // Calculate stats
  const stats: SimulatorStats = (() => {
    const closedTrades = trades.filter((t) => t.status === "closed");
    const winCount = closedTrades.filter((t) => (t.result_pnl ?? 0) > 0).length;
    const lossCount = closedTrades.filter((t) => (t.result_pnl ?? 0) <= 0).length;
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.result_pnl ?? 0), 0);
    const activeTrades = trades.filter((t) => t.status === "open").length;

    return {
      totalTrades: closedTrades.length,
      winCount,
      lossCount,
      accuracy: closedTrades.length > 0 ? Math.round((winCount / closedTrades.length) * 100) : 0,
      totalPnl: Math.round(totalPnl * 100) / 100,
      activeTrades,
      virtualBalance: Math.round((INITIAL_VIRTUAL_BALANCE * (1 + totalPnl / 100)) * 100) / 100,
    };
  })();

  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");

  return {
    trades,
    openTrades,
    closedTrades,
    stats,
    loading,
    error,
    canOpenTrade,
    tradesRemaining,
    dailyLimit,
    todayTradeCount,
    openTrade,
    closeTrade,
    refetch: fetchTrades,
  };
}
