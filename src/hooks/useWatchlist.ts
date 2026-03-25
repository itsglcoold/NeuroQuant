"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("watchlist")
          .eq("id", user.id)
          .single();
        if (data?.watchlist) setWatchlist(data.watchlist as string[]);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(async (symbol: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const next = watchlist.includes(symbol)
      ? watchlist.filter((s) => s !== symbol)
      : [...watchlist, symbol];

    setWatchlist(next);

    await supabase
      .from("profiles")
      .update({ watchlist: next })
      .eq("id", user.id);
  }, [supabase, watchlist]);

  return { watchlist, loading, toggle, isPinned: (s: string) => watchlist.includes(s) };
}
