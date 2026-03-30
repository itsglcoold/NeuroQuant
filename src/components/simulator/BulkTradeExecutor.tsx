"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Minus, CheckSquare, Square, Play, RotateCcw, AlertTriangle,
  CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETS } from "@/lib/market/symbols";
import type { BulkScanResult } from "@/app/api/trades/bulk-scan/route";
import type { AnalysisSnapshot } from "@/types/simulator";

// ── Style definitions (mirror QuickSimWidget) ───────────────────────────────
const STYLES = {
  auto:       { label: "Auto",       atrMult: 1.2, rr: 2.5 },
  safe:       { label: "Safe",       atrMult: 1.5, rr: 2.0 },
  balanced:   { label: "Balanced",   atrMult: 1.2, rr: 2.5 },
  aggressive: { label: "Aggressive", atrMult: 1.0, rr: 3.0 },
} as const;
type StyleKey = keyof typeof STYLES;

const TIMEFRAMES = ["1D", "4H", "1H", "15m", "5m"] as const;
type TF = typeof TIMEFRAMES[number];

// ── Per-market row state ─────────────────────────────────────────────────────
interface MarketRow {
  symbol: string;
  category: string;
  selected: boolean;
  style: StyleKey;
  timeframe: TF;
  // After scan:
  price?: number;
  atr?: number;
  direction?: "bullish" | "bearish" | "neutral";
  confidence?: number;
  signals?: string[];
  scanError?: string;
  // After execute:
  execStatus?: "pending" | "executing" | "opened" | "skipped" | "failed";
  execReason?: string;
}

interface BulkTradeExecutorProps {
  openTrade: (params: {
    symbol: string;
    side: "long" | "short";
    entryPrice: number;
    slPrice: number;
    tpPrice: number;
    analysisSnapshot?: AnalysisSnapshot;
  }) => Promise<{ success: boolean; error?: string }>;
  canOpenTrade: boolean;
  tradesRemaining: number;
  dailyLimit: number | typeof Infinity;
}

// Compute SL/TP from price + ATR + style + direction
function computeSlTp(price: number, atr: number, style: StyleKey, side: "long" | "short") {
  const s = STYLES[style === "auto" ? "balanced" : style];
  const slDist = s.atrMult * Math.max(atr, price * 0.003); // min 0.3% slDist
  if (side === "long") {
    return { slPrice: price - slDist, tpPrice: price + s.rr * slDist };
  } else {
    return { slPrice: price + slDist, tpPrice: price - s.rr * slDist };
  }
}

const STYLE_COLORS: Record<StyleKey, string> = {
  auto:       "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  safe:       "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  balanced:   "bg-green-500/10 text-green-600 dark:text-green-400",
  aggressive: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function BulkTradeExecutor({
  openTrade, canOpenTrade, tradesRemaining, dailyLimit,
}: BulkTradeExecutorProps) {
  const [expanded, setExpanded] = useState(false);

  // Global defaults
  const [globalStyle, setGlobalStyle] = useState<StyleKey>("auto");
  const [globalTf, setGlobalTf] = useState<TF>("1D");
  const [minConfidence, setMinConfidence] = useState(50);

  // Market rows — initialised from MARKETS
  const [rows, setRows] = useState<MarketRow[]>(() =>
    MARKETS.map((m) => ({
      symbol: m.symbol,
      category: m.category,
      selected: true,
      style: "auto" as StyleKey,
      timeframe: "1D" as TF,
    }))
  );

  const [scanning, setScanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "scanned" | "done">("idle");
  const [execSummary, setExecSummary] = useState<{ opened: number; skipped: number; failed: number } | null>(null);

  // ── Selection helpers ───────────────────────────────────────────────────
  const selectAll = () => setRows((r) => r.map((row) => ({ ...row, selected: true })));
  const deselectAll = () => setRows((r) => r.map((row) => ({ ...row, selected: false })));
  const selectCat = (cat: string) =>
    setRows((r) => r.map((row) => ({ ...row, selected: row.category === cat })));
  const applyGlobalSettings = () =>
    setRows((r) =>
      r.map((row) => ({ ...row, style: globalStyle, timeframe: globalTf }))
    );

  const toggleRow = (symbol: string) =>
    setRows((r) => r.map((row) => row.symbol === symbol ? { ...row, selected: !row.selected } : row));
  const setRowStyle = (symbol: string, style: StyleKey) =>
    setRows((r) => r.map((row) => row.symbol === symbol ? { ...row, style } : row));
  const setRowTf = (symbol: string, tf: TF) =>
    setRows((r) => r.map((row) => row.symbol === symbol ? { ...row, timeframe: tf } : row));

  // ── Scan ────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;

    setScanning(true);
    setPhase("idle");
    // Reset scan results
    setRows((r) => r.map((row) => ({
      ...row,
      price: undefined, atr: undefined, direction: undefined,
      confidence: undefined, signals: undefined, scanError: undefined,
      execStatus: undefined, execReason: undefined,
    })));

    // Group by timeframe to batch requests
    const tfGroups = new Map<TF, string[]>();
    for (const row of selected) {
      if (!tfGroups.has(row.timeframe)) tfGroups.set(row.timeframe, []);
      tfGroups.get(row.timeframe)!.push(row.symbol);
    }

    const allResults: BulkScanResult[] = [];
    for (const [tf, symbols] of tfGroups.entries()) {
      try {
        const res = await fetch("/api/trades/bulk-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols, timeframe: tf }),
        });
        if (res.ok) {
          const data = await res.json();
          allResults.push(...(data.results as BulkScanResult[]));
        }
      } catch { /* ignore individual batch errors */ }
    }

    // Merge results back into rows
    const resultMap = new Map(allResults.map((r) => [r.symbol, r]));
    setRows((prev) =>
      prev.map((row) => {
        const result = resultMap.get(row.symbol);
        if (!result) return row;
        return {
          ...row,
          price: result.price,
          atr: result.atr,
          direction: result.direction,
          confidence: result.confidence,
          signals: result.signals,
          scanError: result.error,
        };
      })
    );

    setScanning(false);
    setPhase("scanned");
  }, [rows]);

  // ── Execute ─────────────────────────────────────────────────────────────
  const handleExecute = useCallback(async () => {
    const toTrade = rows.filter(
      (r) =>
        r.selected &&
        r.price &&
        r.atr &&
        r.direction &&
        r.direction !== "neutral" &&
        (r.confidence ?? 0) >= minConfidence
    );
    if (toTrade.length === 0) return;

    setExecuting(true);
    let opened = 0, skipped = 0, failed = 0;

    for (const row of toTrade) {
      // Mark executing
      setRows((prev) =>
        prev.map((r) => r.symbol === row.symbol ? { ...r, execStatus: "executing" } : r)
      );

      const side: "long" | "short" = row.direction === "bullish" ? "long" : "short";
      const { slPrice, tpPrice } = computeSlTp(row.price!, row.atr!, row.style, side);

      const result = await openTrade({
        symbol: row.symbol,
        side,
        entryPrice: row.price!,
        slPrice,
        tpPrice,
      });

      if (result.success) {
        opened++;
        setRows((prev) =>
          prev.map((r) =>
            r.symbol === row.symbol ? { ...r, execStatus: "opened", execReason: `${row.style} · ${side}` } : r
          )
        );
      } else {
        // Check if it's a limit error
        if (result.error?.includes("Daily limit") || result.error?.includes("limit")) {
          skipped++;
          setRows((prev) =>
            prev.map((r) =>
              r.symbol === row.symbol ? { ...r, execStatus: "skipped", execReason: "Daily limit reached" } : r
            )
          );
          // No point continuing if limit is hit
          // Mark remaining as skipped
          const remaining = toTrade.slice(toTrade.indexOf(row) + 1);
          for (const rem of remaining) {
            skipped++;
            setRows((prev) =>
              prev.map((r) =>
                r.symbol === rem.symbol ? { ...r, execStatus: "skipped", execReason: "Daily limit reached" } : r
              )
            );
          }
          break;
        } else {
          failed++;
          setRows((prev) =>
            prev.map((r) =>
              r.symbol === row.symbol ? { ...r, execStatus: "failed", execReason: result.error } : r
            )
          );
        }
      }
    }

    // Markets that were selected but below confidence threshold → skipped
    const belowConf = rows.filter(
      (r) =>
        r.selected &&
        r.price &&
        (r.direction === "neutral" || (r.confidence ?? 0) < minConfidence)
    );
    for (const row of belowConf) {
      skipped++;
      setRows((prev) =>
        prev.map((r) =>
          r.symbol === row.symbol ? { ...r, execStatus: "skipped", execReason: `Confidence ${r.confidence ?? 0}% < ${minConfidence}%` } : r
        )
      );
    }

    setExecSummary({ opened, skipped, failed });
    setExecuting(false);
    setPhase("done");
  }, [rows, openTrade, minConfidence]);

  // ── Counts ──────────────────────────────────────────────────────────────
  const selectedCount = rows.filter((r) => r.selected).length;
  const readyToTrade = rows.filter(
    (r) =>
      r.selected &&
      r.price &&
      r.direction &&
      r.direction !== "neutral" &&
      (r.confidence ?? 0) >= minConfidence
  ).length;

  return (
    <Card className="border-blue-500/20 bg-blue-500/3">
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            Bulk Trade Executor
            {selectedCount > 0 && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                {selectedCount} selected
              </Badge>
            )}
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select markets, scan for signals, then open all trades in one click
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* ── Global Settings ── */}
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Global Defaults</p>
            <div className="flex flex-wrap gap-3 items-end">
              {/* Style */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Style</p>
                <div className="flex gap-1">
                  {(Object.keys(STYLES) as StyleKey[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setGlobalStyle(s)}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-semibold border transition-colors",
                        globalStyle === s
                          ? "border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {STYLES[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Timeframe</p>
                <div className="flex gap-1">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setGlobalTf(tf)}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-semibold border transition-colors",
                        globalTf === tf
                          ? "border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min Confidence */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Min Confidence: {minConfidence}%</p>
                <input
                  type="range" min={0} max={100} step={5} value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="w-32"
                />
              </div>

              <Button size="sm" variant="outline" className="text-xs h-7" onClick={applyGlobalSettings}>
                Apply to all
              </Button>
            </div>
          </div>

          {/* ── Selection buttons ── */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={selectAll} className="px-2 py-1 rounded text-[10px] font-medium border border-border text-muted-foreground hover:bg-accent transition-colors">
              All ({MARKETS.length})
            </button>
            <button onClick={() => selectCat("forex")} className="px-2 py-1 rounded text-[10px] font-medium border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors">
              Forex
            </button>
            <button onClick={() => selectCat("metals")} className="px-2 py-1 rounded text-[10px] font-medium border border-yellow-500/30 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-500/10 transition-colors">
              Metals
            </button>
            <button onClick={() => selectCat("energy")} className="px-2 py-1 rounded text-[10px] font-medium border border-emerald-500/30 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10 transition-colors">
              Energy
            </button>
            <button onClick={() => selectCat("indices")} className="px-2 py-1 rounded text-[10px] font-medium border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
              Indices
            </button>
            <button onClick={deselectAll} className="px-2 py-1 rounded text-[10px] font-medium border border-border text-muted-foreground hover:bg-accent transition-colors">
              None
            </button>
          </div>

          {/* ── Market Table ── */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left p-2 font-semibold text-muted-foreground w-6"></th>
                  <th className="text-left p-2 font-semibold text-muted-foreground">Market</th>
                  <th className="text-left p-2 font-semibold text-muted-foreground hidden sm:table-cell">Style</th>
                  <th className="text-left p-2 font-semibold text-muted-foreground hidden md:table-cell">TF</th>
                  <th className="text-right p-2 font-semibold text-muted-foreground">Signal</th>
                  <th className="text-right p-2 font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr
                    key={row.symbol}
                    className={cn(
                      "transition-colors",
                      row.selected ? "bg-background hover:bg-accent/30" : "bg-secondary/20 opacity-50"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="p-2">
                      <button onClick={() => toggleRow(row.symbol)}>
                        {row.selected
                          ? <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
                          : <Square className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </button>
                    </td>

                    {/* Symbol */}
                    <td className="p-2 font-medium">{row.symbol}</td>

                    {/* Style override */}
                    <td className="p-2 hidden sm:table-cell">
                      <select
                        value={row.style}
                        onChange={(e) => setRowStyle(row.symbol, e.target.value as StyleKey)}
                        className="bg-transparent text-[10px] border border-border rounded px-1 py-0.5 cursor-pointer text-muted-foreground"
                      >
                        {(Object.keys(STYLES) as StyleKey[]).map((s) => (
                          <option key={s} value={s}>{STYLES[s].label}</option>
                        ))}
                      </select>
                    </td>

                    {/* TF override */}
                    <td className="p-2 hidden md:table-cell">
                      <select
                        value={row.timeframe}
                        onChange={(e) => setRowTf(row.symbol, e.target.value as TF)}
                        className="bg-transparent text-[10px] border border-border rounded px-1 py-0.5 cursor-pointer text-muted-foreground"
                      >
                        {TIMEFRAMES.map((tf) => (
                          <option key={tf} value={tf}>{tf}</option>
                        ))}
                      </select>
                    </td>

                    {/* Signal / Confidence */}
                    <td className="p-2 text-right">
                      {row.scanError ? (
                        <span className="text-red-500 text-[10px]">Error</span>
                      ) : row.direction ? (
                        <div className="flex items-center justify-end gap-1">
                          {row.direction === "bullish" ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : row.direction === "bearish" ? (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          ) : (
                            <Minus className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className={cn(
                            "text-[10px] font-semibold tabular-nums",
                            (row.confidence ?? 0) >= minConfidence ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {row.confidence}%
                          </span>
                          {(row.confidence ?? 0) < minConfidence && (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                      ) : scanning ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>

                    {/* Exec status */}
                    <td className="p-2 text-right">
                      {row.execStatus === "executing" && (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500 ml-auto" />
                      )}
                      {row.execStatus === "opened" && (
                        <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
                      )}
                      {row.execStatus === "skipped" && (
                        <Minus className="h-3 w-3 text-muted-foreground ml-auto" />
                      )}
                      {row.execStatus === "failed" && (
                        <XCircle className="h-3 w-3 text-red-500 ml-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Legend for status column ── */}
          {phase !== "idle" && (
            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Opened</span>
              <span className="flex items-center gap-1"><Minus className="h-3 w-3" /> Skipped</span>
              <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" /> Failed</span>
            </div>
          )}

          {/* ── Summary after execute ── */}
          {execSummary && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs flex gap-4">
              <span className="text-green-500 font-semibold">{execSummary.opened} opened</span>
              <span className="text-muted-foreground">{execSummary.skipped} skipped</span>
              {execSummary.failed > 0 && <span className="text-red-500">{execSummary.failed} failed</span>}
            </div>
          )}

          {/* ── Trade limit warning ── */}
          {!canOpenTrade && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Daily trade limit reached ({dailyLimit === Infinity ? "∞" : dailyLimit} trades/day). Wait for open trades to close.
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex gap-2">
            <Button
              onClick={handleScan}
              disabled={scanning || executing || selectedCount === 0}
              variant="outline"
              className="flex-1 text-xs h-9"
            >
              {scanning ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Scanning {selectedCount} markets…</>
              ) : (
                <><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Scan {selectedCount} Markets</>
              )}
            </Button>

            {phase === "scanned" && (
              <Button
                onClick={handleExecute}
                disabled={executing || !canOpenTrade || readyToTrade === 0}
                className="flex-1 text-xs h-9"
              >
                {executing ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Executing…</>
                ) : (
                  <><Play className="h-3.5 w-3.5 mr-1.5" /> Trade {readyToTrade} Markets</>
                )}
              </Button>
            )}
          </div>

          {phase === "scanned" && readyToTrade > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              {readyToTrade} markets meet the {minConfidence}% confidence threshold · {selectedCount - readyToTrade} will be skipped
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
