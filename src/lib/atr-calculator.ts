export interface OHLCBar {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Calculate Average True Range (ATR) from OHLC bars.
 * ATR measures average market volatility over `period` candles.
 * A SL smaller than 0.5× ATR is typically too tight.
 */
export function calculateATR(bars: OHLCBar[], period = 14): number {
  if (!bars || bars.length < period + 1) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    trueRanges.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    );
  }

  const recent = trueRanges.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}
