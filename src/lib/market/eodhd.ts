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
  // Energy
  "CL": "CLUSD.FOREX",
  // Indices
  "DXY": "DXY.INDX",
  "SPX": "GSPC.INDX",
  "IXIC": "IXIC.INDX",
};

// Some symbols need a different ticker for EOD (end-of-day) vs real-time
// e.g. Crude Oil: CLUSD.FOREX works for real-time, but CL.US works for EOD
const EOD_SYMBOL_MAP: Record<string, string> = {
  "CL": "CL.US",
};

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
  });
  if (!response.ok) {
    throw new Error(`EODHD API error: ${response.status}`);
  }
  return response.json();
}

function safeFloat(val: unknown): number {
  if (val === "NA" || val === null || val === undefined) return 0;
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

export async function getPrice(symbol: string): Promise<MarketPrice> {
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

  return {
    symbol,
    price,
    change: safeFloat(data.change),
    changePercent: safeFloat(data.change_p),
    high: safeFloat(data.high),
    low: safeFloat(data.low),
    open: safeFloat(data.open),
    previousClose: safeFloat(data.previousClose),
    timestamp: data.timestamp && data.timestamp !== "NA" ? data.timestamp * 1000 : 0,
  };
}

export async function getPrices(symbols: string[]): Promise<MarketPrice[]> {
  if (symbols.length === 0) return [];
  if (symbols.length === 1) return [await getPrice(symbols[0])];

  // Use EODHD batch endpoint: /real-time/{first}?s={rest,comma,separated}
  const eodSymbols = symbols.map((s) => ({ original: s, eod: toEodhdSymbol(s) }));
  const first = eodSymbols[0];
  const rest = eodSymbols.slice(1);

  const searchParams = new URLSearchParams({
    api_token: API_KEY || "",
    fmt: "json",
    s: rest.map((s) => s.eod).join(","),
  });

  const url = `${BASE_URL}/real-time/${first.eod}?${searchParams}`;
  const response = await fetch(url, { next: { revalidate: 0 } });

  if (!response.ok) {
    // Fallback to individual fetches
    const results = await Promise.allSettled(symbols.map((s) => getPrice(s)));
    return results
      .filter((r): r is PromiseFulfilledResult<MarketPrice> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  const data = await response.json();

  // Build reverse map: EODHD symbol → app symbol
  const reverseMap: Record<string, string> = {};
  for (const s of eodSymbols) {
    reverseMap[s.eod] = s.original;
  }

  const parseItem = (item: Record<string, unknown>, fallbackSymbol: string): MarketPrice => ({
    symbol: reverseMap[item.code as string] || fallbackSymbol,
    price: safeFloat(item.close) || safeFloat(item.previousClose),
    change: safeFloat(item.change),
    changePercent: safeFloat(item.change_p),
    high: safeFloat(item.high),
    low: safeFloat(item.low),
    open: safeFloat(item.open),
    previousClose: safeFloat(item.previousClose),
    timestamp: item.timestamp && item.timestamp !== "NA" ? (item.timestamp as number) * 1000 : 0,
  });

  // When using ?s= param, response is an array (first symbol included)
  let results: MarketPrice[];
  if (Array.isArray(data)) {
    results = data.map((item: Record<string, unknown>) => {
      const code = (item.code as string) || "";
      return parseItem(item, reverseMap[code] || code);
    });
  } else {
    // Single-item fallback (shouldn't happen with ?s= but just in case)
    results = [parseItem(data, first.original)];
  }

  // For any items with price 0 (e.g. Crude Oil outside trading hours),
  // try EOD fallback with alternative ticker
  const needsFallback = results.filter((r) => r.price === 0 && EOD_SYMBOL_MAP[r.symbol]);
  if (needsFallback.length > 0) {
    const fallbacks = await Promise.allSettled(
      needsFallback.map((r) => getPrice(r.symbol))
    );
    const fallbackMap = new Map<string, MarketPrice>();
    fallbacks.forEach((f, i) => {
      if (f.status === "fulfilled" && f.value.price > 0) {
        fallbackMap.set(needsFallback[i].symbol, f.value);
      }
    });
    results = results.map((r) => fallbackMap.get(r.symbol) || r);
  }

  return results;
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
    open: parseFloat(String(bar.open)),
    high: parseFloat(String(bar.high)),
    low: parseFloat(String(bar.low)),
    close: parseFloat(String(bar.close)) || parseFloat(String(bar.adjusted_close)),
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

  return {
    rsi: rsiLatest ? parseFloat(String(rsiLatest.rsi)) : null,
    macd: macdLatest
      ? {
          macd: parseFloat(String(macdLatest.macd)),
          signal: parseFloat(String(macdLatest.macd_signal)),
          histogram: parseFloat(String(macdLatest.macd_hist)),
        }
      : null,
    sma20: sma20Latest ? parseFloat(String(sma20Latest.sma)) : null,
    sma50: sma50Latest ? parseFloat(String(sma50Latest.sma)) : null,
    ema12: null,
    ema26: null,
    bollingerBands: bbLatest
      ? {
          upper: parseFloat(String(bbLatest.uband)),
          middle: parseFloat(String(bbLatest.mband)),
          lower: parseFloat(String(bbLatest.lband)),
        }
      : null,
  };
}
