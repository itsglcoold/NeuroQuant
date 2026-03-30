"use client";

import { useEffect, useState } from "react";
import { getMarketSessionStatus, type MarketSessionStatus } from "@/lib/weekend-risk";

export function MarketSessionIndicator() {
  const [session, setSession] = useState<MarketSessionStatus | null>(null);

  useEffect(() => {
    setSession(getMarketSessionStatus());
    // Refresh every minute
    const interval = setInterval(() => setSession(getMarketSessionStatus()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!session) return null;

  if (!session.isOpen) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        Closed · {session.nextEventLabel}
      </div>
    );
  }

  if (session.hoursUntilClose !== null && session.hoursUntilClose < 4) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        {session.nextEventLabel}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-md">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {session.nextEventLabel}
    </div>
  );
}
