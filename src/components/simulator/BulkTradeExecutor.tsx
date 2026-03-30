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
import { MARKETS, getSymbolTradingStyle } from "@/lib/market/symbols";
import { calculateATR } from "@/lib/atr-calculator";
import type { AnalysisSnapshot } from "@/types/simulator";

// ── Style definitions (mirror QuickSimWidget exactly) ────────────────────────
const STYLES = {
  auto:       { label: "Auto",       atrMult: 1.2, rr: 2.5 },
  safe:       { label: "Safe",       atrMult: 1.5, rr: 2.0 },
  balanced:   { label: "Balanced",   atrMult: 1.2, rr: 2.5 },
  aggressive: { label: "Aggressive", atrMult: 1.0, rr: 3.0 },
} as const;
type StyleKey = keyof typeof STYLES;

const TIMEFRAMES = ["1D", "4H", "1H", "15m", "5m"] as const;
type TF = typeof TIMEFRAMES[number];

const TF_TO_INTERVAL: Record<TF, string> = {
  "1D": "1day", "4H": "4h", "1H": "1h", "15m": "15min", "5m": "5min",
};

/** Map trading style → best scan timeframe (avoid 5m noise) */
function defaultTfForSymbol(symbol: string): TF {
  const style = getSymbolTradingStyle(symbol);
  if (!style) return "1H";
  switch (style.key) {
    case "scalping":   return "15m"; // 5m has too much noise
    case "daytrading": return "1H";
    case "swing":      return "4H";
    default:           return "1H";
  }
}

// ── Decimal precision per symbol ─────────────────────────────────────────────
function fmtPrice(price: number, symbol: string): string {
  if (symbol.includes("JPY")) return price.toFixed(3);
  if (symbol === "XAU/USD" || symbol === "XAG/USD") return price.toFixed(2);
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(5);
  return price.toFixed(5);
}

// ── Per-market row state ─────────────────────────────────────────────────────
interface AnalystSignal {
  name: string; // "Alpha" | "Beta" | "Gamma"
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
}

interface MarketRow {
  symbol: string;
  category: string;
  selected: boolean;
  style: StyleKey;
  timeframe: TF;
  // After AI scan (same data as manual flow):
  price?: number;
  atr?: number;
  direction?: "bullish" | "bearish" | "neutral";
  confidence?: number;    // 0–100 (|consensusScore|)
  agreementLevel?: string;
  analysts?: AnalystSignal[];
  scanning?: boolean;
  scanError?: string;
  // After execute:
  execStatus?: "executing" | "opened" | "skipped" | "failed";
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

// ── SL/TP — same formula as QuickSimWidget handleStyleSelect ─────────────────
function computeSlTp(price: number, atr: number, style: StyleKey, side: "long" | "short") {
  const s = STYLES[style === "auto" ? "balanced" : style];
  const slDist = s.atrMult * Math.max(atr, price * 0.003);
  return side === "long"
    ? { slPrice: price - slDist, tpPrice: price + s.rr * slDist }
    : { slPrice: price + slDist, tpPrice: price - s.rr * slDist };
}

// ── Consume the analysis SSE stream — same endpoint as manual flow ───────────
const ANALYST_NAMES = ["Alpha", "Beta", "Gamma"];

async function analyzeMarket(symbol: string, tf: TF): Promise<{
  price: number;
  atr: number;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  agreementLevel: string;
  analysts: AnalystSignal[];
}> {
  const interval = TF_TO_INTERVAL[tf];
  const tradingStyle = getSymbolTradingStyle(symbol)?.key;

  const response = await fetch("/api/analysis/technical", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, interval, tradingStyle }),
  });

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try { const j = await response.json(); errMsg = j.error ?? errMsg; } catch { /* */ }
    throw new Error(errMsg);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let price = 0;
  let timeSeries: { open: number; high: number; low: number; close: number; datetime: string }[] = [];
  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let confidence = 0;
  let agreementLevel = "low";
  let analysts: AnalystSignal[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const { event, data } = JSON.parse(line.slice(6));
        if (event === "market_data") {
          price = data.price?.price ?? 0;
          timeSeries = data.timeSeries ?? [];
        }
        if (event === "consensus") {
          price = data.price?.price ?? price;
          direction = data.consensus?.consensusDirection ?? "neutral";
          confidence = Math.round(Math.abs(data.consensus?.consensusScore ?? 0));
          agreementLevel = data.consensus?.agreementLevel ?? "low";
          // Extract individual analyst results from consensusResult
          const individual = data.consensus?.individualAnalyses ?? [];
          analysts = individual.map((a: { direction: string; confidence: number }, i: number) => ({
            name: ANALYST_NAMES[i] ?? `A${i + 1}`,
            direction: a.direction as "bullish" | "bearish" | "neutral",
            confidence: Math.round(a.confidence),
          }));
        }
      } catch { /* skip malformed SSE lines */ }
    }
  }

  const atr = timeSeries.length >= 15 ? calculateATR(timeSeries, 14) : price * 0.005;

  return { price, atr, direction, confidence, agreementLevel, analysts };
}

// ── Component ────────────────────────────────────────────────────────────────
export function BulkTradeExecutor({
  openTrade, canOpenTrade, tradesRemaining, dailyLimit,
}: BulkTradeExecutorProps) {
  const [expanded, setExpanded] = useState(false);
  const [globalStyle, setGlobalStyle] = useState<StyleKey>("auto");
  const [globalTf, setGlobalTf] = useState<TF>("1H");
  const [minConfidence, setMinConfidence] = useState(50);

  const [rows, setRows] = useState<MarketRow[]>(() =>
    MARKETS.map((m) => ({
      symbol: m.symbol,
      category: m.category,
      selected: true,
      style: "auto" as StyleKey,
      timeframe: defaultTfForSymbol(m.symbol),
    }))
  );

  const [executing, setExecuting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "scanning" | "scanned" | "done">("idle");
  const [execSummary, setExecSummary] = useState<{ opened: number; skipped: number; failed: number } | null>(null);

  // ── Selection helpers ───────────────────────────────────────────────────
  const selectAll = () => setRows((r) => r.map((row) => ({ ...row, selected: true })));
  const deselectAll = () => setRows((r) => r.map((row) => ({ ...row, selected: false })));
  const selectCat = (cat: string) =>
    setRows((r) => r.map((row) => ({ ...row, selected: row.category === cat })));
  const applyGlobalSettings = () =>
    setRows((r) => r.map((row) => ({ ...row, style: globalStyle, timeframe: globalTf })));

  const toggleRow = (symbol: string) =>
    setRows((r) => r.map((row) => row.symbol === symbol ? { ...row, selected: !row.selected } : row));
  const setRowStyle = (symbol: string, style: StyleKey) =>
    setRows((r) => r.map((row) => row.symbol === symbol ? { ...row, style } : row));
  const setRowTf = (symbol: string, tf: TF) =>
    setRows((r) => r.map((row) => row.symbol === symbol ? { ...row, timeframe: tf } : row));

  // ── Scan — calls the same /api/analysis/technical as manual flow ─────────
  const handleScan = useCallback(async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;

    setPhase("scanning");
    setExecSummary(null);

    // Reset scan + exec state
    setRows((r) => r.map((row) => ({
      ...row,
      price: undefined, atr: undefined, direction: undefined,
      confidence: undefined, agreementLevel: undefined,
      scanning: row.selected ? true : undefined,
      scanError: undefined, execStatus: undefined, execReason: undefined,
    })));

    // Process in parallel batches of 3 to avoid overloading AI APIs
    const BATCH = 3;
    for (let i = 0; i < selected.length; i += BATCH) {
      const batch = selected.slice(i, i + BATCH);
      await Promise.all(batch.map(async (row) => {
        try {
          const result = await analyzeMarket(row.symbol, row.timeframe);
          setRows((prev) => prev.map((r) =>
            r.symbol === row.symbol
              ? { ...r, ...result, scanning: false }
              : r
          ));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setRows((prev) => prev.map((r) =>
            r.symbol === row.symbol
              ? { ...r, scanning: false, scanError: msg.includes("429") ? "Rate limit" : "Error" }
              : r
          ));
        }
      }));
    }

    setPhase("scanned");
  }, [rows]);

  // ── Execute ─────────────────────────────────────────────────────────────
  const handleExecute = useCallback(async () => {
    const toTrade = rows.filter(
      (r) => r.selected && r.price && r.atr && r.direction && r.direction !== "neutral"
             && (r.confidence ?? 0) >= minConfidence
    );
    if (toTrade.length === 0) return;

    setExecuting(true);
    let opened = 0, skipped = 0, failed = 0;
    let limitHit = false;

    for (const row of toTrade) {
      if (limitHit) {
        skipped++;
        setRows((p) => p.map((r) => r.symbol === row.symbol
          ? { ...r, execStatus: "skipped", execReason: "Daily limit reached" } : r));
        continue;
      }

      setRows((p) => p.map((r) => r.symbol === row.symbol ? { ...r, execStatus: "executing" } : r));

      const side: "long" | "short" = row.direction === "bullish" ? "long" : "short";
      const { slPrice, tpPrice } = computeSlTp(row.price!, row.atr!, row.style, side);
      const result = await openTrade({ symbol: row.symbol, side, entryPrice: row.price!, slPrice, tpPrice });

      if (result.success) {
        opened++;
        const { slPrice: sl, tpPrice: tp } = computeSlTp(row.price!, row.atr!, row.style, side);
        setRows((p) => p.map((r) => r.symbol === row.symbol
          ? { ...r, execStatus: "opened", execReason: `${side} @ ${fmtPrice(row.price!, row.symbol)} · SL ${fmtPrice(sl, row.symbol)} · TP ${fmtPrice(tp, row.symbol)}` } : r));
      } else if (result.error?.toLowerCase().includes("limit")) {
        limitHit = true;
        skipped++;
        setRows((p) => p.map((r) => r.symbol === row.symbol
          ? { ...r, execStatus: "skipped", execReason: "Daily limit reached" } : r));
      } else {
        failed++;
        setRows((p) => p.map((r) => r.symbol === row.symbol
          ? { ...r, execStatus: "failed", execReason: result.error } : r));
      }
    }

    // Mark low-confidence selected markets as skipped
    rows.filter((r) => r.selected && r.price && !toTrade.includes(r)).forEach((row) => {
      skipped++;
      setRows((p) => p.map((r) => r.symbol === row.symbol
        ? { ...r, execStatus: "skipped", execReason: r.direction === "neutral" ? "Neutral signal" : `Confidence ${r.confidence ?? 0}% < ${minConfidence}%` }
        : r));
    });

    setExecSummary({ opened, skipped, failed });
    setExecuting(false);
    setPhase("done");
  }, [rows, openTrade, minConfidence]);

  const selectedCount = rows.filter((r) => r.selected).length;
  const scannedCount = rows.filter((r) => r.selected && r.direction && !r.scanning).length;
  const readyToTrade = rows.filter(
    (r) => r.selected && r.price && r.direction && r.direction !== "neutral" && (r.confidence ?? 0) >= minConfidence
  ).length;
  const isScanning = phase === "scanning";

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
          Full AI analysis per market — same signals as manual trading
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* ── Global Settings ── */}
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Global Defaults</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Style</p>
                <div className="flex gap-1">
                  {(Object.keys(STYLES) as StyleKey[]).map((s) => (
                    <button key={s} onClick={() => setGlobalStyle(s)} className={cn(
                      "px-2 py-1 rounded text-[10px] font-semibold border transition-colors",
                      globalStyle === s ? "border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400" : "border-border text-muted-foreground hover:bg-accent"
                    )}>
                      {STYLES[s].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Timeframe</p>
                <div className="flex gap-1">
                  {TIMEFRAMES.map((tf) => (
                    <button key={tf} onClick={() => setGlobalTf(tf)} className={cn(
                      "px-2 py-1 rounded text-[10px] font-semibold border transition-colors",
                      globalTf === tf ? "border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400" : "border-border text-muted-foreground hover:bg-accent"
                    )}>
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Min Confidence: {minConfidence}%</p>
                <input type="range" min={0} max={100} step={5} value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))} className="w-32" />
              </div>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={applyGlobalSettings}>
                Apply to all
              </Button>
            </div>
          </div>

          {/* ── Selection buttons ── */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: `All (${MARKETS.length})`, action: selectAll, cls: "border-border text-muted-foreground hover:bg-accent" },
              { label: "Forex", action: () => selectCat("forex"), cls: "border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10" },
              { label: "Metals", action: () => selectCat("metals"), cls: "border-yellow-500/30 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-500/10" },
              { label: "Energy", action: () => selectCat("energy"), cls: "border-emerald-500/30 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10" },
              { label: "Indices", action: () => selectCat("indices"), cls: "border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10" },
              { label: "None", action: deselectAll, cls: "border-border text-muted-foreground hover:bg-accent" },
            ].map(({ label, action, cls }) => (
              <button key={label} onClick={action} className={cn("px-2 py-1 rounded text-[10px] font-medium border transition-colors", cls)}>
                {label}
              </button>
            ))}
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
                  <th className="text-right p-2 font-semibold text-muted-foreground">AI Signal</th>
                  <th className="text-right p-2 font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.symbol} className={cn(
                    "transition-colors",
                    row.selected ? "bg-background hover:bg-accent/30" : "bg-secondary/20 opacity-50"
                  )}>
                    <td className="p-2">
                      <button onClick={() => toggleRow(row.symbol)}>
                        {row.selected ? <CheckSquare className="h-3.5 w-3.5 text-blue-500" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </td>
                    <td className="p-2 font-medium">{row.symbol}</td>
                    <td className="p-2 hidden sm:table-cell">
                      <select value={row.style} onChange={(e) => setRowStyle(row.symbol, e.target.value as StyleKey)}
                        className="bg-transparent text-[10px] border border-border rounded px-1 py-0.5 cursor-pointer text-muted-foreground">
                        {(Object.keys(STYLES) as StyleKey[]).map((s) => (
                          <option key={s} value={s}>{STYLES[s].label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 hidden md:table-cell">
                      <select value={row.timeframe} onChange={(e) => setRowTf(row.symbol, e.target.value as TF)}
                        className="bg-transparent text-[10px] border border-border rounded px-1 py-0.5 cursor-pointer text-muted-foreground">
                        {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                      </select>
                    </td>

                    {/* AI Signal column */}
                    <td className="p-2 text-right">
                      {row.scanning ? (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500 ml-auto" />
                      ) : row.scanError ? (
                        <span className="text-red-500 text-[10px]">{row.scanError}</span>
                      ) : row.direction ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {/* Consensus */}
                          <div className="flex items-center gap-1">
                            {row.direction === "bullish" ? <TrendingUp className="h-3 w-3 text-green-500" /> :
                             row.direction === "bearish" ? <TrendingDown className="h-3 w-3 text-red-500" /> :
                             <Minus className="h-3 w-3 text-muted-foreground" />}
                            <span className={cn("text-[10px] font-semibold tabular-nums",
                              (row.confidence ?? 0) >= minConfidence ? "text-foreground" : "text-muted-foreground")}>
                              {row.confidence}%
                            </span>
                            {(row.confidence ?? 0) < minConfidence && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                          </div>
                          {/* Analyst breakdown */}
                          {row.analysts && row.analysts.length > 0 && (
                            <div className="flex items-center gap-0.5">
                              {row.analysts.map((a) => (
                                <span key={a.name} title={`${a.name}: ${a.direction} ${a.confidence}%`}
                                  className={cn("text-[8px] font-semibold px-0.5 rounded tabular-nums",
                                    a.direction === "bullish" ? "text-green-500" :
                                    a.direction === "bearish" ? "text-red-400" : "text-muted-foreground"
                                  )}>
                                  {a.name[0]}{a.confidence}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>

                    {/* Exec status column */}
                    <td className="p-2 text-right">
                      {row.execStatus === "executing" && <Loader2 className="h-3 w-3 animate-spin text-blue-500 ml-auto" />}
                      {row.execStatus === "opened" && (
                        <div className="flex flex-col items-end gap-0.5">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {row.execReason && <span className="text-[8px] text-green-500/70 leading-tight max-w-[120px] text-right">{row.execReason}</span>}
                        </div>
                      )}
                      {row.execStatus === "skipped" && (
                        <div className="flex flex-col items-end gap-0.5">
                          <Minus className="h-3 w-3 text-muted-foreground" />
                          {row.execReason && <span className="text-[8px] text-muted-foreground leading-tight">{row.execReason}</span>}
                        </div>
                      )}
                      {row.execStatus === "failed" && (
                        <div className="flex flex-col items-end gap-0.5">
                          <XCircle className="h-3 w-3 text-red-500" />
                          {row.execReason && <span className="text-[8px] text-red-400 leading-tight">{row.execReason}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Scan progress ── */}
          {isScanning && (
            <p className="text-[10px] text-muted-foreground text-center animate-pulse">
              AI analysing {scannedCount}/{selectedCount} markets (batches of 3)…
            </p>
          )}

          {/* ── Summary ── */}
          {execSummary && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs flex gap-4">
              <span className="text-green-500 font-semibold">{execSummary.opened} opened</span>
              <span className="text-muted-foreground">{execSummary.skipped} skipped</span>
              {execSummary.failed > 0 && <span className="text-red-500">{execSummary.failed} failed</span>}
            </div>
          )}

          {/* ── Daily limit warning ── */}
          {!canOpenTrade && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Daily trade limit reached ({dailyLimit === Infinity ? "∞" : dailyLimit}/day). Wait for open trades to close.
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex gap-2">
            <Button onClick={handleScan} disabled={isScanning || executing || selectedCount === 0}
              variant="outline" className="flex-1 text-xs h-9">
              {isScanning ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing {scannedCount}/{selectedCount}…</>
              ) : (
                <><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Scan {selectedCount} Markets (AI)</>
              )}
            </Button>

            {phase === "scanned" && (
              <Button onClick={handleExecute} disabled={executing || !canOpenTrade || readyToTrade === 0}
                className="flex-1 text-xs h-9">
                {executing ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Executing…</>
                ) : (
                  <><Play className="h-3.5 w-3.5 mr-1.5" />Trade {readyToTrade} Markets</>
                )}
              </Button>
            )}
          </div>

          {phase === "scanned" && (
            <p className="text-[10px] text-muted-foreground text-center">
              {readyToTrade} markets ready · {selectedCount - readyToTrade} skipped (neutral or low confidence)
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
