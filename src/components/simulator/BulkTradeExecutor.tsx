"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETS, getSymbolTradingStyle } from "@/lib/market/symbols";

const CATEGORIES = [
  { key: "all",     label: "All" },
  { key: "none",    label: "None" },
  { key: "forex",   label: "Forex",   cls: "border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10" },
  { key: "metals",  label: "Metals",  cls: "border-yellow-500/30 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-500/10" },
  { key: "energy",  label: "Energy",  cls: "border-emerald-500/30 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10" },
  { key: "indices", label: "Indices", cls: "border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10" },
];

export function BulkTradeExecutor() {
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [popupBlocked, setPopupBlocked] = useState(false);

  const toggle = (symbol: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });

  const selectAll  = () => setSelected(new Set(MARKETS.map((m) => m.symbol)));
  const selectNone = () => setSelected(new Set());
  const selectCat  = (cat: string) => setSelected(new Set(MARKETS.filter((m) => m.category === cat).map((m) => m.symbol)));

  const openTabs = () => {
    setPopupBlocked(false);
    let blocked = false;
    for (const symbol of Array.from(selected)) {
      const style = getSymbolTradingStyle(symbol)?.key;
      const params = new URLSearchParams({ autoAnalyse: "true" });
      if (style) params.set("style", style);
      const w = window.open(`/dashboard/market/${encodeURIComponent(symbol)}?${params}`, "_blank");
      if (!w) blocked = true;
    }
    if (blocked) setPopupBlocked(true);
  };

  const count = selected.size;

  return (
    <Card className="border-blue-500/20 bg-blue-500/3">
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            Multi-Market Analyser
            {count > 0 && (
              <span className="text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                {count} selected
              </span>
            )}
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select markets → open each in its own tab for AI analysis and trading
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 pt-0">
          {/* Category filters */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(({ key, label, cls }) => (
              <button
                key={key}
                onClick={() => key === "all" ? selectAll() : key === "none" ? selectNone() : selectCat(key)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium border transition-colors",
                  cls ?? "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Market grid */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
            {MARKETS.map((m) => {
              const isSelected = selected.has(m.symbol);
              return (
                <button
                  key={m.symbol}
                  onClick={() => toggle(m.symbol)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg border p-1.5 transition-colors text-left",
                    isSelected
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-border hover:border-blue-500/30 hover:bg-blue-500/5"
                  )}
                >
                  <span className="text-sm">{m.emoji}</span>
                  <span className={cn(
                    "text-[9px] font-medium text-center leading-tight truncate w-full",
                    isSelected ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                  )}>
                    {m.symbol}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Popup blocked warning */}
          {popupBlocked && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Your browser is blocking pop-ups. Click the pop-up icon in the address bar and select <strong>"Always allow pop-ups for this site"</strong>, then the button will work directly.
              </span>
            </div>
          )}

          {/* Open tabs button */}
          <button
            disabled={count === 0}
            onClick={openTabs}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 rounded-lg border px-4 h-9 text-sm font-medium transition-colors",
              count === 0
                ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                : "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {count === 0 ? "Select markets to analyse" : `Analyse ${count} market${count > 1 ? "s" : ""} in tabs`}
          </button>
        </CardContent>
      )}
    </Card>
  );
}
