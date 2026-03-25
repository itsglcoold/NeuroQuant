"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity, Copy, Check, RefreshCw, TrendingUp, TrendingDown,
  X, AlertTriangle, Wifi, WifiOff, ChevronDown, ChevronUp,
  Lock, DollarSign, Code,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const RISK_ACCEPTED_KEY = "nq_mt5_risk_accepted";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://neuroquant.app";

interface MT5Connection {
  webhook_token: string;
  webhook_secret: string;
  is_active: boolean;
  account_info?: {
    balance?: number;
    equity?: number;
    margin_free?: number;
    account?: string;
    broker?: string;
  };
  last_heartbeat?: string;
}

interface MT5Trade {
  id: string;
  mt5_ticket: number;
  symbol: string;
  direction: "buy" | "sell";
  volume: number;
  open_price: number;
  current_price?: number;
  stop_loss?: number;
  take_profit?: number;
  profit: number;
  open_time: string;
  status: "open" | "closed";
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

// ─── Risk Disclaimer ──────────────────────────────────────────────────────────
function RiskDisclaimer({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <Card className="max-w-lg w-full border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            Risk Disclosure — Live Trading
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            By using the MT5 Live Trading integration you acknowledge and accept the following risks:
          </p>
          <ul className="list-disc pl-4 space-y-2">
            <li>
              <strong className="text-foreground">Real money is at risk.</strong> Trades executed via this integration affect your live MT5 account with real funds.
            </li>
            <li>
              <strong className="text-foreground">No guarantee of execution.</strong> Commands sent from NeuroQuant depend on your MT5 terminal being online. Delayed or failed execution can result in losses.
            </li>
            <li>
              <strong className="text-foreground">No investment advice.</strong> NeuroQuant AI analysis is for educational purposes only and does not constitute financial advice.
            </li>
            <li>
              <strong className="text-foreground">You are solely responsible</strong> for all trading decisions and any resulting profits or losses.
            </li>
            <li>
              <strong className="text-foreground">Keep your webhook secret private.</strong> Anyone with your secret can send trade commands to your MT5 account.
            </li>
          </ul>
          <p>
            Trading Forex, CFDs and other leveraged instruments carries a high level of risk and may not be suitable for all investors.
          </p>
          <Button className="w-full" onClick={onAccept}>
            I understand the risks — Continue
          </Button>
          <p className="text-center text-xs text-muted-foreground/60">
            This confirmation is stored locally on your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Setup Wizard ─────────────────────────────────────────────────────────────
function SetupWizard({ onSetup }: { onSetup: (conn: MT5Connection) => void }) {
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/mt5", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setup" }),
    });
    const data = await res.json();
    if (data.connection) onSetup(data.connection);
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto text-center space-y-4 py-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
        <Activity className="h-8 w-8 text-blue-500" />
      </div>
      <h2 className="text-xl font-semibold">Connect MetaTrader 5</h2>
      <p className="text-sm text-muted-foreground">
        Generate your unique webhook URL. Install the NeuroQuant EA in your MT5 terminal — then your live trades appear here and you can close them with one click.
      </p>
      <Button onClick={generate} disabled={loading} className="w-full max-w-xs">
        {loading ? "Generating…" : "Generate Webhook URL"}
      </Button>
    </div>
  );
}

// ─── Connection Card ──────────────────────────────────────────────────────────
function ConnectionCard({ conn }: { conn: MT5Connection }) {
  const [showSecret, setShowSecret] = useState(false);
  const [showEA, setShowEA] = useState(false);
  const [copied, setCopied] = useState<"url" | "secret" | "ea" | null>(null);

  const webhookUrl = `${APP_URL}/api/mt5/webhook/${conn.webhook_token}`;

  const isOnline =
    conn.last_heartbeat &&
    Date.now() - new Date(conn.last_heartbeat).getTime() < 90_000;

  function copy(text: string, key: "url" | "secret" | "ea") {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const eaCode = `//+------------------------------------------------------------------+
//| NeuroQuant EA v1.0 — paste your credentials below               |
//+------------------------------------------------------------------+
#property strict

input string WebhookURL   = "${webhookUrl}";
input string WebhookSecret= "${conn.webhook_secret}";
input int    PollSeconds  = 10;   // how often to poll for close commands

// Full EA source available at: https://neuroquant.app/mt5-ea
// This snippet shows the configuration — download the full .mq5 file
// from your NeuroQuant dashboard and compile it in MetaEditor.`;

  return (
    <Card className={`border ${isOnline ? "border-green-500/30" : "border-border"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {isOnline
              ? <Wifi className="h-4 w-4 text-green-500" />
              : <WifiOff className="h-4 w-4 text-muted-foreground" />}
            EA Status: {isOnline ? (
              <span className="text-green-500">Online</span>
            ) : (
              <span className="text-muted-foreground">Offline / Not installed</span>
            )}
          </CardTitle>
          {conn.last_heartbeat && (
            <span className="text-xs text-muted-foreground">
              Last ping: {timeAgo(conn.last_heartbeat)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Webhook URL */}
        <div>
          <p className="text-xs font-medium mb-1 text-muted-foreground">Webhook URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-2.5 py-1.5 text-xs break-all">
              {webhookUrl}
            </code>
            <button
              onClick={() => copy(webhookUrl, "url")}
              className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
            >
              {copied === "url" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Secret */}
        <div>
          <p className="text-xs font-medium mb-1 text-muted-foreground">Webhook Secret</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-2.5 py-1.5 text-xs break-all">
              {showSecret ? conn.webhook_secret : "••••••••••••••••••••••••"}
            </code>
            <button
              onClick={() => setShowSecret(v => !v)}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              {showSecret ? "Hide" : "Show"}
            </button>
            <button
              onClick={() => copy(conn.webhook_secret, "secret")}
              className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
            >
              {copied === "secret" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* EA Config snippet */}
        <div>
          <button
            onClick={() => setShowEA(v => !v)}
            className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400"
          >
            <Code className="h-3.5 w-3.5" />
            {showEA ? "Hide" : "Show"} EA configuration
            {showEA ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showEA && (
            <div className="mt-2 relative">
              <pre className="rounded-md bg-muted p-3 text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                {eaCode}
              </pre>
              <button
                onClick={() => copy(eaCode, "ea")}
                className="absolute top-2 right-2 p-1 rounded bg-background hover:bg-muted"
              >
                {copied === "ea" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/60">
          Install the NeuroQuant EA in MetaEditor, enter the Webhook URL and Secret, enable automated trading, then attach it to any chart. Your trades will sync automatically.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LiveTradingPage() {
  const { tier } = useUsageTracking();
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [connection, setConnection] = useState<MT5Connection | null>(null);
  const [trades, setTrades] = useState<MT5Trade[]>([]);
  const [loadingConn, setLoadingConn] = useState(true);
  const [closingTicket, setClosingTicket] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    setRiskAccepted(localStorage.getItem(RISK_ACCEPTED_KEY) === "1");
  }, []);

  function acceptRisk() {
    localStorage.setItem(RISK_ACCEPTED_KEY, "1");
    setRiskAccepted(true);
  }

  const loadConnection = useCallback(async () => {
    const res = await fetch("/api/mt5");
    if (res.ok) {
      const data = await res.json();
      setConnection(data.connection);
    }
    setLoadingConn(false);
  }, []);

  const loadTrades = useCallback(async () => {
    const { data } = await supabase
      .from("mt5_trades")
      .select("*")
      .eq("status", "open")
      .order("open_time", { ascending: false });
    setTrades((data as MT5Trade[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    if (tier !== "premium" || !riskAccepted) return;
    loadConnection();
    loadTrades();
  }, [tier, riskAccepted, loadConnection, loadTrades]);

  // Realtime subscription for trade updates
  useEffect(() => {
    if (tier !== "premium" || !riskAccepted) return;
    const channel = supabase
      .channel("mt5_trades_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "mt5_trades" }, () => {
        loadTrades();
        loadConnection(); // refresh account_info + heartbeat
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tier, riskAccepted, supabase, loadTrades, loadConnection]);

  async function closeTrade(ticket: number) {
    setClosingTicket(ticket);
    const res = await fetch("/api/mt5/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
    });
    const data = await res.json();
    setClosingTicket(null);
    if (!data.ok) alert(data.error ?? "Failed to queue close command");
  }

  async function closeAllProfitable() {
    const profitable = trades.filter(t => t.profit > 0);
    if (!profitable.length) return;
    if (!confirm(`Close ${profitable.length} profitable trade${profitable.length > 1 ? "s" : ""}?`)) return;
    for (const t of profitable) await closeTrade(t.mt5_ticket);
  }

  // ── Premium gate ──
  if (tier !== "premium") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <Lock className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold">Premium Feature</h2>
          <p className="text-sm text-muted-foreground">
            MT5 Live Trading integration is available on the Premium plan.
          </p>
          <Link href="/pricing" className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Upgrade to Premium
          </Link>
        </div>
      </div>
    );
  }

  if (!riskAccepted) return <RiskDisclaimer onAccept={acceptRisk} />;

  if (loadingConn) {
    return <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground text-sm">Loading…</div>;
  }

  const totalProfit = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
  const acct = connection?.account_info;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Live Trading
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your real MT5 trades — close them directly from NeuroQuant
          </p>
        </div>
        <button
          onClick={() => { loadTrades(); loadConnection(); }}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Account summary */}
      {acct && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Balance", value: `$${(acct.balance ?? 0).toFixed(2)}` },
            { label: "Equity", value: `$${(acct.equity ?? 0).toFixed(2)}` },
            { label: "Free Margin", value: `$${(acct.margin_free ?? 0).toFixed(2)}` },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold mt-0.5">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Connection card */}
      {connection ? (
        <ConnectionCard conn={connection} />
      ) : (
        <SetupWizard onSetup={(conn) => setConnection(conn)} />
      )}

      {/* Open trades */}
      {connection && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Open Trades {trades.length > 0 && `(${trades.length})`}
            </h2>
            {trades.some(t => t.profit > 0) && (
              <button
                onClick={closeAllProfitable}
                className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors"
              >
                <DollarSign className="h-3.5 w-3.5" />
                Close All Profitable
              </button>
            )}
          </div>

          {trades.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No open trades in MT5.
                <br />
                <span className="text-xs text-muted-foreground/60 mt-1 block">
                  Open a trade in MT5 — it will appear here automatically.
                </span>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Total P&L */}
              <div className="flex justify-end">
                <span className={`text-sm font-semibold ${totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  Total P&L: {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}
                </span>
              </div>

              <div className="space-y-2">
                {trades.map((trade) => (
                  <Card key={trade.id} className={`border ${trade.profit > 0 ? "border-green-500/20" : trade.profit < 0 ? "border-red-500/20" : "border-border"}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      {/* Direction badge */}
                      <span className={`shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${trade.direction === "buy" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                        {trade.direction === "buy"
                          ? <TrendingUp className="h-3 w-3" />
                          : <TrendingDown className="h-3 w-3" />}
                        {trade.direction.toUpperCase()}
                      </span>

                      {/* Symbol + volume */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{trade.symbol}</p>
                        <p className="text-xs text-muted-foreground">{trade.volume} lot · opened {timeAgo(trade.open_time)}</p>
                      </div>

                      {/* Prices */}
                      <div className="hidden sm:block text-right text-xs text-muted-foreground">
                        <p>Entry: {trade.open_price.toFixed(5)}</p>
                        {trade.current_price && <p>Now: {trade.current_price.toFixed(5)}</p>}
                      </div>

                      {/* P&L */}
                      <div className={`text-sm font-bold w-20 text-right ${trade.profit > 0 ? "text-green-500" : trade.profit < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {trade.profit > 0 ? "+" : ""}${trade.profit.toFixed(2)}
                      </div>

                      {/* Close button */}
                      <button
                        onClick={() => closeTrade(trade.mt5_ticket)}
                        disabled={closingTicket === trade.mt5_ticket}
                        className="shrink-0 flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
                        title="Close this trade in MT5"
                      >
                        {closingTicket === trade.mt5_ticket
                          ? <RefreshCw className="h-3 w-3 animate-spin" />
                          : <X className="h-3 w-3" />}
                        Close
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* How it works */}
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground/80 mb-2">How it works</p>
          <p>1. Generate your webhook URL above and copy it.</p>
          <p>2. Download the NeuroQuant EA, compile it in MetaEditor, and drag it onto any chart.</p>
          <p>3. Enter your Webhook URL and Secret in the EA settings. Enable automated trading in MT5.</p>
          <p>4. All open trades in MT5 appear here automatically. Close any trade with one click — the EA executes it instantly.</p>
          <p className="pt-1 text-muted-foreground/60">The EA polls for commands every 10 seconds. Your MT5 terminal must be running.</p>
        </CardContent>
      </Card>
    </div>
  );
}
