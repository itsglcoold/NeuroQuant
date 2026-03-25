"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellRing, Plus, Trash2, X, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import Link from "next/link";

interface Alert {
  id: string;
  symbol: string;
  target_price: number;
  direction: "above" | "below";
  created_at: string;
}

interface Props {
  symbol: string;
  currentPrice: number;
  priceDecimals?: number;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function PriceAlertButton({ symbol, currentPrice, priceDecimals = 4 }: Props) {
  const { canAccessFeature } = useUsageTracking();
  const canUseAlerts = canAccessFeature("price-alerts");
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts((data.alerts as Alert[]).filter((a) => a.symbol === symbol));
      }
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (open) loadAlerts();
  }, [open, loadAlerts]);

  // Pre-fill target price based on direction
  useEffect(() => {
    if (!targetPrice && currentPrice) {
      const step = currentPrice * 0.005; // 0.5% away
      setTargetPrice(
        (direction === "above" ? currentPrice + step : currentPrice - step).toFixed(priceDecimals)
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, currentPrice]);

  async function createAlert() {
    const price = parseFloat(targetPrice);
    if (!price || isNaN(price) || price <= 0) {
      setError("Enter a valid price");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, targetPrice: price, direction }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create alert");
      } else {
        setAlerts((prev) => [data.alert as Alert, ...prev]);
        setTargetPrice("");
      }
    } catch {
      setError("Failed to create alert");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAlert(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  if (!canUseAlerts) {
    return (
      <Link
        href="/pricing"
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50 transition-colors"
        title="Upgrade to Pro to set price alerts"
      >
        <Lock className="h-3.5 w-3.5" />
        Alert
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          alerts.length > 0
            ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "border-border text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50"
        }`}
      >
        {alerts.length > 0 ? (
          <BellRing className="h-3.5 w-3.5" />
        ) : (
          <Bell className="h-3.5 w-3.5" />
        )}
        Alert {alerts.length > 0 && `(${alerts.length})`}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72">
          <Card className="border border-border/80 shadow-lg">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Price Alerts — {symbol}</p>
                <button onClick={() => setOpen(false)}>
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>

              {/* Create new alert */}
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setDirection("above")}
                    className={`flex-1 rounded-md py-1.5 text-[11px] font-medium border transition-colors ${
                      direction === "above"
                        ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    ↑ Above
                  </button>
                  <button
                    onClick={() => setDirection("below")}
                    className={`flex-1 rounded-md py-1.5 text-[11px] font-medium border transition-colors ${
                      direction === "below"
                        ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    ↓ Below
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder={currentPrice.toFixed(priceDecimals)}
                    className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    step={Math.pow(10, -priceDecimals)}
                  />
                  <Button
                    size="sm"
                    onClick={createAlert}
                    disabled={saving}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Set
                  </Button>
                </div>
                {error && <p className="text-[10px] text-red-500">{error}</p>}
                <p className="text-[9px] text-muted-foreground/60">
                  You&apos;ll receive an email when price hits your target. One-time alert.
                </p>
              </div>

              {/* Existing alerts */}
              {loading ? (
                <p className="text-[10px] text-muted-foreground text-center py-1">Loading…</p>
              ) : alerts.length > 0 ? (
                <div className="space-y-1 border-t border-border/20 pt-2">
                  <p className="text-[10px] text-muted-foreground font-medium">Active alerts</p>
                  {alerts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                      <div className="text-[11px]">
                        <span className={a.direction === "above" ? "text-green-500" : "text-red-500"}>
                          {a.direction === "above" ? "≥" : "≤"} {a.target_price}
                        </span>
                        <span className="text-muted-foreground ml-1.5">{timeAgo(a.created_at)}</span>
                      </div>
                      <button
                        onClick={() => deleteAlert(a.id)}
                        className="text-muted-foreground/40 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
