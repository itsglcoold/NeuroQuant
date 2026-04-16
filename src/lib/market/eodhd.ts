import { MarketPrice, OHLCVBar, TechnicalIndicators } from "@/types/market";

const BASE_URL = "https://eodhd.com/api";
const API_KEY = process.env.EODHD_API_KEY;

// EODHD uses SYMBOL.EXCHANGE format
// Map our app symbols to EODHD format
const SYMBOL_MAP: Record<string, string> = {
  // Forex — Majors
  "EUR/USD": "EURUSD.FOREX",
  "GBP/USD": "GBPUSD.FOREX",
  "USD/JPY": "USDJPY.FOREX",
  "USD/CHF": "USDCHF.FOREX",
  "AUD/USD": "AUDUSD.FOREX",
  "NZD/USD": "NZDUSD.FOREX",
  "USD/CAD": "USDCAD.FOREX",
  // Forex — JPY Crosses
  "EUR/JPY": "EURJPY.FOREX",
  "GBP/JPY": "GBPJPY.FOREX",
  "AUD/JPY": "AUDJPY.FOREX",
  "NZD/JPY": "NZDJPY.FOREX",
  "CAD/JPY": "CADJPY.FOREX",
  // Forex — GBP Crosses
  "EUR/GBP": "EURGBP.FOREX",
  "GBP/AUD": "GBPAUD.FOREX",
  "GBP/NZD": "GBPNZD.FOREX",
  "GBP/CAD": "GBPCAD.FOREX",
  "GBP/CHF": "GBPCHF.FOREX",
  // Forex — AUD/NZD Crosses
  "AUD/CAD": "AUDCAD.FOREX",
  "AUD/CHF": "AUDCHF.FOREX",
  "AUD/NZD": "AUDNZD.FOREX",
  "EUR/AUD": "EURAUD.FOREX",
  "NZD/CAD": "NZDCAD.FOREX",
  // Metals
  "XAU/USD": "XAUUSD.FOREX",
  "XAG/USD": "XAGUSD.FOREX",
  // Energy — use futures contract (CL.US) for accurate real-time pricing
  // CLUSD.FOREX on the forex endpoint gives unreliable/stale prices
  "CL": "CL.US",
  // Indices
  "DXY": "DXY.INDX",
  "SPX": "GSPC.INDX",
  "IXIC": "NDX.INDX",
};

// Symbols that need a different ticker for EOD (historical/daily) data
const EOD_SYMBOL_MAP: Record<string, string> = {};

function toEodhdSymbol(symbol: string): string {
  return SYMBOL_MAP[symbol] || symbol;
}

function toEodhdEodSymbol(symbol: string): string {
  return EOD_SYMBOL_MAP[symbol] || SYMBOL_MAP[symbol] || symbol;
}

async function fetchEodhd(
  endpoint: string,
  params: Record<string, string> = {},
  cacheSecs: number = 0
) {
  const searchParams = new URLSearchParams({
    ...params,
    api_token: API_KEY || "",
    fmt: "json",
  });
  const url = `${BASE_URL}/${endpoint}?${searchParams}`;

  const response = await fetch(url, {
    next: { revalidate: cacheSecs },
    signal: AbortSignal.timeout(8000), // 8s max per EODHD call — prevents hanging connections
  });
  if (!response.ok) {
    // Check for rate limit error
    const text = await response.text().catch(() => "");
    if (text.includes("exceeded") || text.includes("limit")) {
      throw new Error(`EODHD API rate limit exceeded`);
    }
    throw new Error(`EODHD API error: ${response.status}`);
  }
  // Check if response is JSON (rate limit returns plain text even with 200)
  const text = await response.text();
  if (text.includes("exceeded") || text.includes("limit")) {
    throw new Error(`EODHD API rate limit exceeded`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`EODHD API returned invalid response`);
  }
}

function safeFloat(val: unknown): number {
  if (val === "NA" || val === null || val === undefined) return 0;
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

// Real-time price for CL (WTI crude oil).
// Strategy:
//   1. EODHD CLUSD.FOREX — forex endpoint, potentially real-time
//   2. Yahoo Finance CL=F — ~15-min delayed but accurate fallback
// EODHD real-time/CL.US is NOT used — it returns the previous EOD settlement.
async function getCLPrice(): Promise<MarketPrice> {
  // 1. Try EODHD forex endpoint first (real-time for paid forex plans)
  try {
    const data = await fetchEodhd("real-time/CLUSD.FOREX");
    const price = safeFloat(data.close) || safeFloat(data.open);
    // Sanity check: WTI crude should be between $20 and $200
    if (price >= 20 && price <= 200) {
      const prevClose = safeFloat(data.previousClose) || safeFloat(data.open) || price;
      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
      return {
        symbol: "CL",
        price,
        change,
        changePercent,
        high: safeFloat(data.high) || price,
        low: safeFloat(data.low) || price,
        open: safeFloat(data.open) || prevClose,
        previousClose: prevClose,
        timestamp: data.timestamp ? Number(data.timestamp) * 1000 : 0,
      };
    }
  } catch {
    // EODHD forex failed — fall through to Yahoo Finance
  }

  // 2. Yahoo Finance fallback (CL=F = WTI front-month futures, ~15-min delayed)
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/CL=F?range=1d&interval=1m&includePrePost=false";
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`Yahoo Finance error: ${resp.status}`);
  const json = await resp.json() as { chart: { result: Array<{ meta: Record<string, number> }> } };
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || !meta.regularMarketPrice) throw new Error("Yahoo Finance: no data");

  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose || meta.previousClose || price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: "CL",
    price,
    change,
    changePercent,
    high: meta.regularMarketDayHigh || price,
    low: meta.regularMarketDayLow || price,
    open: meta.regularMarketOpen || prevClose,
    previousClose: prevClose,
    timestamp: (meta.regularMarketTime || 0) * 1000,
  };
}

// Real-time price for XAU/USD (Gold) and XAG/USD (Silver).
// Strategy:
//   1. Yahoo Finance XAUUSD=X / XAGUSD=X — spot price, matches OANDA:XAUUSD / TradingView
//   2. Yahoo Finance GC=F / SI=F — COMEX futures fallback (~$20-25 premium over spot for gold)
//   3. EODHD XAUUSD.FOREX / XAGUSD.FOREX — last resort (may return LBMA London Fix snapshot)
async function getMetalPrice(symbol: "XAU/USD" | "XAG/USD"): Promise<MarketPrice> {
  const eodhdTicker = symbol === "XAU/USD" ? "XAUUSD.FOREX" : "XAGUSD.FOREX";
  // Spot tickers: XAUUSD=X / XAGUSD=X match the OANDA spot feed shown on TradingView
  const spotTicker  = symbol === "XAU/USD" ? "XAUUSD=X" : "XAGUSD=X";
  // Futures tickers: ~$20-25 premium over spot for gold — use only as fallback
  const futuresTicker = symbol === "XAU/USD" ? "GC=F" : "SI=F";
  // Sanity ranges: Gold $500–$15000, Silver $5–$500
  const [minPrice, maxPrice] = symbol === "XAU/USD" ? [500, 15000] : [5, 500];

  // Helper: fetch a Yahoo Finance ticker and return the MarketPrice, or null on failure
  async function tryYahoo(ticker: string): Promise<MarketPrice | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1m&includePrePost=false`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return null;
      const json = await resp.json() as { chart: { result: Array<{ meta: Record<string, number> }> } };
      const meta = json?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      if (!price || price < minPrice || price > maxPrice) return null;
      const prevClose = meta.chartPreviousClose || meta.previousClose || price;
      const change = price - prevClose;
      return {
        symbol,
        price,
        change,
        changePercent: prevClose > 0 ? (change / prevClose) * 100 : 0,
        high: meta.regularMarketDayHigh || price,
        low: meta.regularMarketDayLow || price,
        open: meta.regularMarketOpen || prevClose,
        previousClose: prevClose,
        timestamp: (meta.regularMarketTime || 0) * 1000,
      };
    } catch {
      return null;
    }
  }

  // 1. Spot price — matches TradingView OANDA:XAUUSD exactly
  const spotResult = await tryYahoo(spotTicker);
  if (spotResult) return spotResult;

  // 2. Futures fallback (contango premium, but better than LBMA snapshot)
  const futuresResult = await tryYahoo(futuresTicker);
  if (futuresResult) return futuresResult;

  // 2. EODHD fallback (may return LBMA benchmark price, but better than nothing)
  const data = await fetchEodhd(`real-time/${eodhdTicker}`);
  const price = safeFloat(data.close) || safeFloat(data.previousClose) || safeFloat(data.open);
  const prevClose = safeFloat(data.previousClose) || safeFloat(data.open) || price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
  return {
    symbol,
    price,
    change,
    changePercent,
    high: safeFloat(data.high) || price,
    low: safeFloat(data.low) || price,
    open: safeFloat(data.open) || prevClose,
    previousClose: prevClose,
    timestamp: data.timestamp ? Number(data.timestamp) * 1000 : 0,
  };
}

export async function getPrice(symbol: string): Promise<MarketPrice> {
  // CL uses a dedicated function — EODHD real-time/CL.US gives stale EOD data
  if (symbol === "CL") {
    return getCLPrice();
  }

  // Metals use dedicated function — primary: Yahoo Finance spot (XAUUSD=X / XAGUSD=X)
  // matches OANDA:XAUUSD on TradingView exactly. Futures (GC=F/SI=F) and EODHD as fallbacks.
  if (symbol === "XAU/USD" || symbol === "XAG/USD") {
    return getMetalPrice(symbol);
  }

  const eodSymbol = toEodhdSymbol(symbol);
  const data = await fetchEodhd(`real-time/${eodSymbol}`);

  const price = safeFloat(data.close) || safeFloat(data.previousClose);

  // If real-time returns all NA, try EOD (end-of-day) data as fallback
  // Use separate EOD ticker if available (e.g. CL → CL.US instead of CLUSD.FOREX)
  if (price === 0) {
    try {
      const eodFallbackSymbol = toEodhdEodSymbol(symbol);
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 7); // Look back a week for last trading day
      const eodData = await fetchEodhd(`eod/${eodFallbackSymbol}`, {
        from: from.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
        order: "d",
      });
      if (Array.isArray(eodData) && eodData.length > 0) {
        const latest = eodData[0];
        return {
          symbol,
          price: safeFloat(latest.adjusted_close) || safeFloat(latest.close),
          change: safeFloat(latest.close) - safeFloat(latest.open),
          changePercent: safeFloat(latest.open) > 0
            ? ((safeFloat(latest.close) - safeFloat(latest.open)) / safeFloat(latest.open)) * 100
            : 0,
          high: safeFloat(latest.high),
          low: safeFloat(latest.low),
          open: safeFloat(latest.open),
          previousClose: safeFloat(latest.close),
          timestamp: new Date(latest.date as string).getTime(),
        };
      }
    } catch {
      // EOD fallback failed, continue with zeros
    }
  }

  // EODHD returns NA for change/change_p on some symbols (e.g. XAUUSD.FOREX, XAGUSD.FOREX, DXY.INDX)
  // Also use open as fallback when previousClose is NA
  const prevClose = safeFloat(data.previousClose) || safeFloat(data.open);
  let change = safeFloat(data.change);
  let changePercent = safeFloat(data.change_p);

  if (change === 0 && price > 0 && prevClose > 0) {
    change = price - prevClose;
    changePercent = (change / prevClose) * 100;
  }

  return {
    symbol,
    price,
    change,
    changePercent,
    high: safeFloat(data.high),
    low: safeFloat(data.low),
    open: safeFloat(data.open),
    previousClose: prevClose,
    timestamp: data.timestamp && data.timestamp !== "NA" ? Number(data.timestamp) * 1000 : 0,
  };
}

// ----- In-memory server-side cache -----
// Prevents multiple users / re-renders from hitting EODHD repeatedly
const priceCache = new Map<string, { data: MarketPrice; ts: number }>();
const PRICE_CACHE_TTL = 15_000; // 15 seconds

function getCachedPrice(symbol: string): MarketPrice | null {
  const entry = priceCache.get(symbol);
  if (entry && Date.now() - entry.ts < PRICE_CACHE_TTL) return entry.data;
  return null;
}

function setCachedPrice(price: MarketPrice) {
  priceCache.set(price.symbol, { data: price, ts: Date.now() });
}

export async function getPrices(symbols: string[]): Promise<MarketPrice[]> {
  if (symbols.length === 0) return [];

  // Split into cached vs needs-fetch
  const cached: MarketPrice[] = [];
  const toFetch: string[] = [];

  for (const s of symbols) {
    const c = getCachedPrice(s);
    if (c) {
      cached.push(c);
    } else {
      toFetch.push(s);
    }
  }

  // Fetch uncached symbols individually (short URLs = fewer API call "characters")
  // EODHD counts each character in the request as 1 API call for Live API,
  // so individual short requests are cheaper than one long batch request.
  const fetched: MarketPrice[] = [];
  if (toFetch.length > 0) {
    const results = await Promise.allSettled(toFetch.map((s) => getPrice(s)));
    for (const r of results) {
      if (r.status === "fulfilled") {
        setCachedPrice(r.value);
        fetched.push(r.value);
      }
    }
  }

  // Return in original order
  const priceMap = new Map<string, MarketPrice>();
  for (const p of [...cached, ...fetched]) priceMap.set(p.symbol, p);
  return symbols.map((s) => priceMap.get(s)).filter((p): p is MarketPrice => !!p);
}

// EODHD intraday interval mapping
const INTRADAY_INTERVALS: Record<string, string> = {
  "1min": "1m",
  "5min": "5m",
  "15min": "15m",
  "1h": "1h",
  "4h": "4h",
};

export async function getTimeSeries(
  symbol: string,
  interval: string = "1day",
  outputSize: number = 30
): Promise<OHLCVBar[]> {
  const isIntraday = interval in INTRADAY_INTERVALS;

  if (isIntraday) {
    return getIntradayTimeSeries(symbol, interval, outputSize);
  }

  // Use EOD-specific ticker for symbols that need it (e.g. CL → CL.US)
  const eodSymbol = toEodhdEodSymbol(symbol);

  // Calculate date range
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - Math.max(outputSize * 2, 60)); // Extra buffer for weekends/holidays

  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];

  // Use EOD endpoint for daily data
  const period = interval === "1day" ? "d" : interval === "1week" ? "w" : interval === "1month" ? "m" : "d";

  const data = await fetchEodhd(`eod/${eodSymbol}`, {
    from: fromStr,
    to: toStr,
    period,
    order: "d", // Descending (newest first)
  }, 120); // Cache EOD data for 2 minutes (it only updates once a day)

  if (!Array.isArray(data)) return [];

  return data.slice(0, outputSize).map((bar: Record<string, string | number>) => ({
    datetime: bar.date as string,
    open: safeFloat(bar.open),
    high: safeFloat(bar.high),
    low: safeFloat(bar.low),
    close: safeFloat(bar.close) || safeFloat(bar.adjusted_close),
    volume: parseInt(String(bar.volume)) || 0,
  }));
}

async function getIntradayTimeSeries(
  symbol: string,
  interval: string,
  outputSize: number
): Promise<OHLCVBar[]> {
  const eodSymbol = toEodhdSymbol(symbol);
  const eodhdInterval = INTRADAY_INTERVALS[interval] || "5m";

  // Calculate date range for intraday: go back enough days to get enough bars
  const to = new Date();
  const from = new Date();
  // For 1min data we need fewer days, for 4h we need more
  const daysBack = interval === "1min" ? 3 : interval === "5min" ? 7 : interval === "15min" ? 14 : 30;
  from.setDate(from.getDate() - daysBack);

  const fromTimestamp = Math.floor(from.getTime() / 1000);
  const toTimestamp = Math.floor(to.getTime() / 1000);

  const data = await fetchEodhd(`intraday/${eodSymbol}`, {
    interval: eodhdInterval,
    from: fromTimestamp.toString(),
    to: toTimestamp.toString(),
  }, 10); // Cache intraday data for 10 seconds only

  if (!Array.isArray(data)) return [];

  // EODHD intraday returns newest-last, take the last N bars
  const bars = data.slice(-outputSize);

  return bars.map((bar: Record<string, string | number>) => ({
    datetime: bar.datetime as string,
    open: safeFloat(bar.open),
    high: safeFloat(bar.high),
    low: safeFloat(bar.low),
    close: safeFloat(bar.close),
    volume: parseInt(String(bar.volume)) || 0,
  }));
}

export async function getTechnicalIndicators(
  symbol: string,
  interval: string = "1day"
): Promise<TechnicalIndicators> {
  // Use EOD-specific ticker for symbols that need it (e.g. CL → CL.US)
  const eodSymbol = toEodhdEodSymbol(symbol);

  const [rsiData, macdData, sma20Data, sma50Data, bbData] = await Promise.allSettled([
    fetchEodhd(`technical/${eodSymbol}`, { function: "rsi", period: "14" }, 60),
    fetchEodhd(`technical/${eodSymbol}`, { function: "macd", fast_period: "12", slow_period: "26", signal_period: "9" }, 60),
    fetchEodhd(`technical/${eodSymbol}`, { function: "sma", period: "20" }, 60),
    fetchEodhd(`technical/${eodSymbol}`, { function: "sma", period: "50" }, 60),
    fetchEodhd(`technical/${eodSymbol}`, { function: "bbands", period: "20" }, 60),
  ]);

  const getLatest = (result: PromiseSettledResult<Record<string, string | number>[]>) => {
    if (result.status === "fulfilled" && Array.isArray(result.value) && result.value.length > 0) {
      return result.value[result.value.length - 1]; // Latest value
    }
    return null;
  };

  const rsiLatest = getLatest(rsiData);
  const macdLatest = getLatest(macdData);
  const sma20Latest = getLatest(sma20Data);
  const sma50Latest = getLatest(sma50Data);
  const bbLatest = getLatest(bbData);

  // Use safeFloat to prevent NaN propagation from bad API data (e.g. "NA" values)
  const safeFloatOrNull = (val: unknown): number | null => {
    if (val === "NA" || val === null || val === undefined) return null;
    const n = parseFloat(String(val));
    return isNaN(n) ? null : n;
  };

  return {
    rsi: rsiLatest ? safeFloatOrNull(rsiLatest.rsi) : null,
    macd: macdLatest
      ? {
          macd: safeFloat(macdLatest.macd),
          signal: safeFloat(macdLatest.macd_signal),
          histogram: safeFloat(macdLatest.macd_hist),
        }
      : null,
    sma20: sma20Latest ? safeFloatOrNull(sma20Latest.sma) : null,
    sma50: sma50Latest ? safeFloatOrNull(sma50Latest.sma) : null,
    ema12: null,
    ema26: null,
    bollingerBands: bbLatest
      ? {
          upper: safeFloat(bbLatest.uband),
          middle: safeFloat(bbLatest.mband),
          lower: safeFloat(bbLatest.lband),
        }
      : null,
  };
}
