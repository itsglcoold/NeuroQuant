"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { MarketPrice } from "@/types/market";

// Map app symbols → EODHD WebSocket symbol format (no exchange suffix)
const WS_SYMBOL_MAP: Record<string, { ws: string; endpoint: "forex" | "us" }> = {
  // Forex — Majors
  "EUR/USD": { ws: "EURUSD", endpoint: "forex" },
  "GBP/USD": { ws: "GBPUSD", endpoint: "forex" },
  "USD/JPY": { ws: "USDJPY", endpoint: "forex" },
  "USD/CHF": { ws: "USDCHF", endpoint: "forex" },
  "AUD/USD": { ws: "AUDUSD", endpoint: "forex" },
  "NZD/USD": { ws: "NZDUSD", endpoint: "forex" },
  "USD/CAD": { ws: "USDCAD", endpoint: "forex" },
  // Forex — JPY Crosses
  "EUR/JPY": { ws: "EURJPY", endpoint: "forex" },
  "GBP/JPY": { ws: "GBPJPY", endpoint: "forex" },
  "AUD/JPY": { ws: "AUDJPY", endpoint: "forex" },
  "NZD/JPY": { ws: "NZDJPY", endpoint: "forex" },
  "CAD/JPY": { ws: "CADJPY", endpoint: "forex" },
  // Forex — GBP Crosses
  "EUR/GBP": { ws: "EURGBP", endpoint: "forex" },
  "GBP/AUD": { ws: "GBPAUD", endpoint: "forex" },
  "GBP/NZD": { ws: "GBPNZD", endpoint: "forex" },
  "GBP/CAD": { ws: "GBPCAD", endpoint: "forex" },
  "GBP/CHF": { ws: "GBPCHF", endpoint: "forex" },
  // Forex — AUD/NZD Crosses
  "AUD/CAD": { ws: "AUDCAD", endpoint: "forex" },
  "AUD/CHF": { ws: "AUDCHF", endpoint: "forex" },
  "AUD/NZD": { ws: "AUDNZD", endpoint: "forex" },
  "EUR/AUD": { ws: "EURAUD", endpoint: "forex" },
  "NZD/CAD": { ws: "NZDCAD", endpoint: "forex" },
  // Metals
  "XAU/USD": { ws: "XAUUSD", endpoint: "forex" },
  "XAG/USD": { ws: "XAGUSD", endpoint: "forex" },
  // Energy
  "CL": { ws: "CLUSD", endpoint: "forex" },
  // Indices — try on /ws/us
  "DXY": { ws: "DXY", endpoint: "us" },
  "SPX": { ws: "GSPC", endpoint: "us" },
  "IXIC": { ws: "IXIC", endpoint: "us" },
};

// Reverse map: WS symbol → app symbol
const WS_REVERSE_MAP: Record<string, string> = {};
for (const [appSym, { ws }] of Object.entries(WS_SYMBOL_MAP)) {
  WS_REVERSE_MAP[ws] = appSym;
}

// Check if forex markets are open (Sun 21:00 – Fri 21:00 UTC)
function isMarketOpen(): boolean {
  const now = new Date();
  const d = now.getUTCDay(), h = now.getUTCHours();
  if (d === 6) return false;
  if (d === 0 && h < 21) return false;
  if (d === 5 && h >= 21) return false;
  return true;
}

interface WebSocketState {
  prices: Record<string, MarketPrice>;
  connected: boolean;
  error: string | null;
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

  const wsForexRef = useRef<WebSocket | null>(null);
  const wsUsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pricesRef = useRef<Record<string, MarketPrice>>({});
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Group symbols by endpoint
  const forexSymbols = symbols.filter((s) => WS_SYMBOL_MAP[s]?.endpoint === "forex");
  const usSymbols = symbols.filter((s) => WS_SYMBOL_MAP[s]?.endpoint === "us");

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // Skip status/heartbeat messages
      if (data.status_code || !data.s) return;

      const appSymbol = WS_REVERSE_MAP[data.s];
      if (!appSymbol) return;

      // EODHD forex WS format: { s, a (ask), b (bid), dc (daily change %), dd (daily diff), t (ms) }
      const price = data.a || data.p || 0; // ask price for forex, or price for stocks
      const bid = data.b || price;

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
          setState((prev) => ({
            ...prev,
            prices: { ...pricesRef.current },
          }));
          batchTimerRef.current = null;
        }, 500);
      }
    } catch {
      // Ignore malformed messages
    }
  }, []);

  const connectEndpoint = useCallback(
    async (endpoint: "forex" | "us", wsSymbols: string[]) => {
      if (wsSymbols.length === 0) return null;

      // Get WebSocket URL from server (keeps API key server-side)
      let wsUrl: string;
      try {
        const res = await fetch("/api/ws-config");
        const config = await res.json();
        wsUrl = config[endpoint];
        if (!wsUrl) return null;
      } catch {
        return null;
      }

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Subscribe to all symbols
        const wsNames = wsSymbols
          .map((s) => WS_SYMBOL_MAP[s]?.ws)
          .filter(Boolean)
          .join(",");

        ws.send(JSON.stringify({ action: "subscribe", symbols: wsNames }));

        setState((prev) => ({ ...prev, connected: true, error: null }));
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setState((prev) => ({ ...prev, error: "WebSocket connection error" }));
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, connected: false }));
        // Auto-reconnect after 5 seconds if markets are open
        if (isMarketOpen()) {
          reconnectTimerRef.current = setTimeout(() => {
            connectEndpoint(endpoint, wsSymbols);
          }, 5000);
        }
      };

      return ws;
    },
    [handleMessage]
  );

  useEffect(() => {
    if (symbols.length === 0 || !isMarketOpen()) return;

    // Connect forex endpoint
    if (forexSymbols.length > 0) {
      connectEndpoint("forex", forexSymbols).then((ws) => {
        wsForexRef.current = ws;
      });
    }

    // Connect US endpoint for indices
    if (usSymbols.length > 0) {
      connectEndpoint("us", usSymbols).then((ws) => {
        wsUsRef.current = ws;
      });
    }

    return () => {
      // Cleanup
      if (wsForexRef.current) {
        wsForexRef.current.close();
        wsForexRef.current = null;
      }
      if (wsUsRef.current) {
        wsUsRef.current.close();
        wsUsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  return state;
}
