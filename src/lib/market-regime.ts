import type { OHLCBar } from "./atr-calculator";
import { calculateATR, getATRAnalysis } from "./atr-calculator";

export type MarketRegime = "trending" | "ranging" | "choppy";

export interface RegimeResult {
  regime: MarketRegime;
  label: string;
  color: "green" | "amber" | "red";
  tip: string;
  /** Recommended minimum R:R for this regime (research-backed) */
  recommendedRR: number;
  /** True when ATR ratio > 1.5 — avoid trading */
  isVolatile: boolean;
  /** ADX value — >25 trending, <20 ranging */
  adx: number;
}

// ---------------------------------------------------------------------------
// ADX (Average Directional Index) — Wilder's formula
// ADX measures trend strength regardless of direction.
// > 25 = trending, < 20 = ranging, 20-25 = ambiguous
// ---------------------------------------------------------------------------
function calculateADX(bars: OHLCBar[], period = 14): number {
  if (bars.length < period + 2) return 0;

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(
      Math.max(
        bars[i].high - bars[i].low,
        Math.abs(bars[i].high - bars[i - 1].close),
        Math.abs(bars[i].low - bars[i - 1].close)
      )
    );
  }

  // Seed Wilder's smoothing
  let sPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sTR = tr.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  for (let i = period; i < plusDM.length; i++) {
    sPlusDM = sPlusDM - sPlusDM / period + plusDM[i];
    sMinusDM = sMinusDM - sMinusDM / period + minusDM[i];
    sTR = sTR - sTR / period + tr[i];

    if (sTR === 0) continue;
    const plusDI = (sPlusDM / sTR) * 100;
    const minusDI = (sMinusDM / sTR) * 100;
    const sum = plusDI + minusDI;
    if (sum === 0) continue;
    dxValues.push((Math.abs(plusDI - minusDI) / sum) * 100);
  }

  if (dxValues.length === 0) return 0;

  // ADX = smoothed average of DX values
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, dxValues.length);
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }
  return Math.round(adx * 10) / 10;
}

// ---------------------------------------------------------------------------
// Main regime detector
// ---------------------------------------------------------------------------

/**
 * Detect market regime using ADX + ATR volatility ratio.
 *
 * Research-backed thresholds:
 * - ATR ratio > 1.5  → choppy spike, skip
 * - ADX > 25         → trending, use trend-following, target 1:3 R:R
 * - ADX < 20         → ranging, use mean reversion, target 1:2 R:R
 * - ADX 20–25        → ambiguous/choppy, reduce size or wait
 */
export function detectMarketRegime(bars: OHLCBar[], symbol = ""): RegimeResult {
  if (!bars || bars.length < 30) {
    return {
      regime: "ranging",
      label: "Unknown",
      color: "amber",
      tip: "Not enough data for regime detection.",
      recommendedRR: 2,
      isVolatile: false,
      adx: 0,
    };
  }

  const atr = getATRAnalysis(bars, symbol);
  const adx = calculateADX(bars, 14);

  // Volatility spike overrides everything
  if (atr.isVolatile) {
    return {
      regime: "choppy",
      label: "Choppy",
      color: "red",
      tip: `Volatility spike (ATR×${atr.ratio.toFixed(1)} vs avg). Wait for calmer conditions.`,
      recommendedRR: 0,
      isVolatile: true,
      adx,
    };
  }

  if (adx > 25) {
    return {
      regime: "trending",
      label: "Trending",
      color: "green",
      tip: `Strong trend (ADX ${adx}). Trend-following setup — target 1:3 R:R.`,
      recommendedRR: 3,
      isVolatile: false,
      adx,
    };
  }

  if (adx < 20) {
    return {
      regime: "ranging",
      label: "Ranging",
      color: "amber",
      tip: `Range-bound market (ADX ${adx}). Mean-reversion — take profits faster, target 1:2 R:R.`,
      recommendedRR: 2,
      isVolatile: false,
      adx,
    };
  }

  // 20–25: ambiguous
  return {
    regime: "choppy",
    label: "No Clear Trend",
    color: "amber",
    tip: `ADX ${adx} — no clear direction. Reduce size or wait for a clearer setup.`,
    recommendedRR: 2,
    isVolatile: false,
    adx,
  };
}
