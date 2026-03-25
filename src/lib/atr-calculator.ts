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
  /** ATR expressed in pips for display */
  pips: number;
}

// ---------------------------------------------------------------------------
// Pip utilities
// ---------------------------------------------------------------------------

const JPY_PAIRS = [
  "USD/JPY", "EUR/JPY", "GBP/JPY", "AUD/JPY",
  "NZD/JPY", "CAD/JPY", "CHF/JPY",
];

export function getPipSize(symbol: string): number {
  return JPY_PAIRS.includes(symbol) ? 0.01 : 0.0001;
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
};

/**
 * Full ATR analysis: value + volatility ratio + pip display.
 * ratio = ATR(14) / rolling-20-bar-avg of ATR(14)
 * ratio > 1.5 → spike/choppy, avoid trading.
 */
export function getATRAnalysis(bars: OHLCBar[], symbol: string): ATRAnalysis {
  if (!bars || bars.length < 35) {
    const value = ATR_DEFAULTS[symbol] ?? 0.0050;
    return {
      value,
      ratio: 1.0,
      isVolatile: false,
      pips: priceToPips(symbol, value),
    };
  }

  const atr14 = calculateATR(bars, 14);

  // Rolling average of ATR(14) over last 20 data-points
  const history: number[] = [];
  const window = Math.min(bars.length, 34); // at least 14+1 bars needed per slice
  for (let end = bars.length - window; end <= bars.length; end++) {
    const slice = bars.slice(Math.max(0, end - 34), end);
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
  };
}
