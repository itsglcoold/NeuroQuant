export interface OHLCBar {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ATRAnalysis {
  value: number;
  /** ATR(14) / ATR(20-bar rolling avg) — >1.5 = volatility spike */
  ratio: number;
  isVolatile: boolean;
  /** ATR expressed in display units (pips for forex, points for indices/metals/energy) */
  pips: number;
  /** Unit label: "p" for forex pips, "pts" for indices/metals/energy */
  pipLabel: string;
}

// ---------------------------------------------------------------------------
// Pip / point utilities
// ---------------------------------------------------------------------------

const JPY_PAIRS = [
  "USD/JPY", "EUR/JPY", "GBP/JPY", "AUD/JPY",
  "NZD/JPY", "CAD/JPY", "CHF/JPY",
];

// Indices, metals, energy — use raw price units (1 point = $1 or 1 unit)
// "pips" don't apply; display as "pts" instead
const POINTS_ASSETS = ["IXIC", "SPX", "DXY", "XAU/USD", "XAG/USD", "CL"];

export function getPipSize(symbol: string): number {
  if (POINTS_ASSETS.includes(symbol)) return 1.0;  // 1 point = 1 price unit
  if (JPY_PAIRS.includes(symbol)) return 0.01;
  return 0.0001; // Standard forex
}

export function getPipLabel(symbol: string): string {
  return POINTS_ASSETS.includes(symbol) ? "pts" : "p";
}

export function priceToPips(symbol: string, priceDiff: number): number {
  return Math.abs(priceDiff) / getPipSize(symbol);
}

export function pipsToPrice(symbol: string, pips: number): number {
  return pips * getPipSize(symbol);
}

// ---------------------------------------------------------------------------
// ATR — Welles Wilder's smoothing (the proper formula)
// ---------------------------------------------------------------------------

/**
 * Calculate ATR using Wilder's smoothing method.
 * First value = SMA of TR over `period`, then EMA-style smoothing.
 */
export function calculateATR(bars: OHLCBar[], period = 14): number {
  if (!bars || bars.length < period + 1) return 0;

  const trValues: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    trValues.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    );
  }

  // Seed with SMA of first `period` TRs
  let atr =
    trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Wilder's smoothing for the rest
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }

  return atr;
}

// ---------------------------------------------------------------------------
// Full ATR analysis with volatility ratio
// ---------------------------------------------------------------------------

const ATR_DEFAULTS: Record<string, number> = {
  "EUR/USD": 0.0050, "GBP/USD": 0.0060, "USD/JPY": 0.50,
  "USD/CHF": 0.0050, "AUD/USD": 0.0045, "NZD/USD": 0.0045,
  "USD/CAD": 0.0050, "EUR/JPY": 0.60,  "GBP/JPY": 0.70,
  "AUD/JPY": 0.45,   "XAU/USD": 15.0,  "XAG/USD": 0.30,
  "CL":      0.80,   "DXY":     0.20,
  // Indices — ATR in price points (1 point = $1)
  "IXIC":    25.0,   "SPX":     20.0,
};

/**
 * Full ATR analysis: value + volatility ratio + pip display.
 * ratio = ATR(14) / rolling-20-bar-avg of ATR(14)
 * ratio > 1.5 → spike/choppy, avoid trading.
 */
export function getATRAnalysis(bars: OHLCBar[], symbol: string): ATRAnalysis {
  const fallbackValue = ATR_DEFAULTS[symbol] ?? 0.0050;

  const label = getPipLabel(symbol);

  if (!bars || bars.length < 35) {
    return {
      value: fallbackValue,
      ratio: 1.0,
      isVolatile: false,
      pips: priceToPips(symbol, fallbackValue),
      pipLabel: label,
    };
  }

  // Filter out outlier bars — candles with H-L > 5% of their close price are corrupt/gap bars
  // that skew ATR wildly (e.g. weekend gaps, bad EODHD data points)
  const cleanBars = bars.filter((b) => b.close > 0 && (b.high - b.low) / b.close < 0.05);
  const workingBars = cleanBars.length >= 35 ? cleanBars : bars;

  const atr14 = calculateATR(workingBars, 14);

  // Sanity check: ATR > 3% of current price means the data is corrupt — fall back to defaults
  const lastClose = workingBars[workingBars.length - 1]?.close ?? 0;
  if (lastClose > 0 && atr14 > lastClose * 0.03) {
    return {
      value: fallbackValue,
      ratio: 1.0,
      isVolatile: false,
      pips: priceToPips(symbol, fallbackValue),
      pipLabel: label,
    };
  }

  // Rolling average of ATR(14) over last 20 data-points
  const history: number[] = [];
  const window = Math.min(workingBars.length, 34); // at least 14+1 bars needed per slice
  for (let end = workingBars.length - window; end <= workingBars.length; end++) {
    const slice = workingBars.slice(Math.max(0, end - 34), end);
    if (slice.length >= 15) history.push(calculateATR(slice, 14));
  }
  const avg20 =
    history.length > 0
      ? history.slice(-20).reduce((s, v) => s + v, 0) /
        Math.min(20, history.length)
      : atr14;

  const ratio = avg20 > 0 ? atr14 / avg20 : 1;

  return {
    value: atr14,
    ratio,
    isVolatile: ratio > 1.5,
    pips: priceToPips(symbol, atr14),
    pipLabel: label,
  };
}
