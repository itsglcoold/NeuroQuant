"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { MarketPrice } from "@/types/market";
import { isMarketOpen } from "@/lib/market/hours";

// Map app symbols → EODHD WebSocket symbol format
// NOTE: EODHD WebSocket only supports forex, crypto, and US equities.
// Indices (DXY, SPX, IXIC) are NOT available via WebSocket — they use REST only.
const WS_SYMBOL_MAP: Record<string, string> = {
  // Forex — Majors
  "EUR/USD": "EURUSD",
  "GBP/USD": "GBPUSD",
  "USD/JPY": "USDJPY",
  "USD/CHF": "USDCHF",
  "AUD/USD": "AUDUSD",
  "NZD/USD": "NZDUSD",
  "USD/CAD": "USDCAD",
  // Forex — JPY Crosses
  "EUR/JPY": "EURJPY",
  "GBP/JPY": "GBPJPY",
  "AUD/JPY": "AUDJPY",
  "NZD/JPY": "NZDJPY",
  "CAD/JPY": "CADJPY",
  // Forex — GBP Crosses
  "EUR/GBP": "EURGBP",
  "GBP/AUD": "GBPAUD",
  "GBP/NZD": "GBPNZD",
  "GBP/CAD": "GBPCAD",
  "GBP/CHF": "GBPCHF",
  // Forex — AUD/NZD Crosses
  "AUD/CAD": "AUDCAD",
  "AUD/CHF": "AUDCHF",
  "AUD/NZD": "AUDNZD",
  "EUR/AUD": "EURAUD",
  "NZD/CAD": "NZDCAD",
  // Metals (available on forex endpoint)
  "XAU/USD": "XAUUSD",
  "XAG/USD": "XAGUSD",
  // NOTE: CL (Crude Oil) intentionally excluded — EODHD forex WS gives stale prices for it.
  // CL uses REST polling instead for consistent, accurate pricing.
};

// Reverse map: WS symbol → app symbol
const WS_REVERSE_MAP: Record<string, string> = {};
for (const [appSym, ws] of Object.entries(WS_SYMBOL_MAP)) {
  WS_REVERSE_MAP[ws] = appSym;
}


interface WebSocketState {
  prices: Record<string, MarketPrice>;
  connected: boolean;
  error: string | null;
}

// Cache the WS config so we only fetch it once
let wsConfigCache: { forex: string } | null = null;
let wsConfigPromise: Promise<{ forex: string } | null> | null = null;

async function getWsConfig(): Promise<{ forex: string } | null> {
  if (wsConfigCache) return wsConfigCache;
  if (wsConfigPromise) return wsConfigPromise;

  wsConfigPromise = fetch("/api/ws-config")
    .then((res) => res.json())
    .then((config) => {
      wsConfigCache = config;
      return config;
    })
    .catch(() => null)
    .finally(() => {
      wsConfigPromise = null;
    });

  return wsConfigPromise;
}

/**
 * Shared WebSocket connection to EODHD for real-time price streaming.
 * Connects to /ws/forex for all forex/metals/energy symbols.
 * Falls back to REST for indices if WebSocket is unavailable.
 *
 * No REST API calls for live prices = 0 daily API call consumption for streaming.
 */
export function useEodhdWebSocket(symbols: string[]) {
  const [state, setState] = useState<WebSocketState>({
    prices: {},
    connected: false,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pricesRef = useRef<Record<string, MarketPrice>>({});
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const reconnectCountRef = useRef(0);

  // Only subscribe to symbols that have WebSocket support (forex/metals/energy)
  // Indices (DXY, SPX, IXIC) are NOT available via EODHD WebSocket
  const wsSymbols = symbols.filter((s) => s in WS_SYMBOL_MAP);
  const symbolKey = wsSymbols.join(",");

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // Skip status/heartbeat messages
      if (data.status_code || !data.s) return;

      const appSymbol = WS_REVERSE_MAP[data.s];
      if (!appSymbol) return;

      // EODHD forex WS format: { s, a (ask), b (bid), dc (daily change %), dd (daily diff), t (ms) }
      const price = data.a || data.p || 0;

      // Update price in ref (batched state update below)
      const existing = pricesRef.current[appSymbol];
      pricesRef.current[appSymbol] = {
        symbol: appSymbol,
        price: price,
        change: data.dd || (existing?.change ?? 0),
        changePercent: data.dc || (existing?.changePercent ?? 0),
        high: Math.max(price, existing?.high ?? 0),
        low: existing?.low ? Math.min(price, existing.low) : price,
        open: existing?.open ?? price,
        previousClose: existing?.previousClose ?? (price - (data.dd || 0)),
        timestamp: data.t || Date.now(),
      };

      // Batch state updates: max every 500ms to avoid excessive re-renders
      if (!batchTimerRef.current) {
        batchTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setState((prev) => ({
              ...prev,
              prices: { ...pricesRef.current },
            }));
          }
          batchTimerRef.current = null;
        }, 500);
      }
    } catch {
      // Ignore malformed messages
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reconnectCountRef.current = 0;

    if (wsSymbols.length === 0 || !isMarketOpen()) return;

    async function connect(): Promise<WebSocket | null> {
      if (!mountedRef.current) return null;

      const config = await getWsConfig();
      if (!config?.forex || !mountedRef.current) return null;

      const ws = new WebSocket(config.forex);

      ws.onopen = () => {
        reconnectCountRef.current = 0;
        const wsNames = wsSymbols
          .map((s) => WS_SYMBOL_MAP[s])
          .filter(Boolean)
          .join(",");

        ws.send(JSON.stringify({ action: "subscribe", symbols: wsNames }));

        if (mountedRef.current) {
          setState((prev) => ({ ...prev, connected: true, error: null }));
        }
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, error: "WebSocket connection error" }));
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;

        setState((prev) => ({ ...prev, connected: false }));

        // Auto-reconnect with exponential backoff (max 60s), max 10 retries
        if (isMarketOpen() && reconnectCountRef.current < 10) {
          const delay = Math.min(5000 * Math.pow(2, reconnectCountRef.current), 60000);
          reconnectCountRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            connect().then((newWs) => {
              wsRef.current = newWs;
            });
          }, delay);
        }
      };

      return ws;
    }

    // Single connection to forex endpoint only
    connect().then((ws) => {
      wsRef.current = ws;
    });

    return () => {
      mountedRef.current = false;

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey, handleMessage]);

  return state;
}
