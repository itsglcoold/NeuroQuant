/**
 * Candlestick Pattern Detection
 * Detects the most tradeable single-, two-, and three-candle patterns.
 */

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DetectedPattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  confidence: number; // 0–100
  description: string;
}

// ---------------------------------------------------------------------------
// Single-candle patterns
// ---------------------------------------------------------------------------

/** Pin Bar — long wick, small body. Hammer (bullish) or Shooting Star (bearish). */
export function detectPinBar(c: Candle): DetectedPattern | null {
  const body = Math.abs(c.close - c.open);
  const upper = c.high - Math.max(c.open, c.close);
  const lower = Math.min(c.open, c.close) - c.low;
  const range = c.high - c.low;
  if (range === 0 || body > range * 0.3) return null;

  if (lower > body * 2 && upper < body * 0.5) {
    return {
      name: "Hammer",
      type: "bullish",
      confidence: Math.min(100, Math.round((lower / Math.max(body, 0.00001)) * 25)),
      description: "Long lower wick — buyers rejected lower prices. Bullish reversal signal.",
    };
  }
  if (upper > body * 2 && lower < body * 0.5) {
    return {
      name: "Shooting Star",
      type: "bearish",
      confidence: Math.min(100, Math.round((upper / Math.max(body, 0.00001)) * 25)),
      description: "Long upper wick — sellers rejected higher prices. Bearish reversal signal.",
    };
  }
  return null;
}

/** Doji — open ≈ close, indicating indecision. */
export function detectDoji(c: Candle): DetectedPattern | null {
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  if (range === 0 || body > range * 0.1) return null;

  const upper = c.high - Math.max(c.open, c.close);
  const lower = Math.min(c.open, c.close) - c.low;

  if (lower > upper * 2)
    return { name: "Dragonfly Doji", type: "bullish", confidence: 68, description: "Open = Close at top of range. Bullish reversal potential." };
  if (upper > lower * 2)
    return { name: "Gravestone Doji", type: "bearish", confidence: 68, description: "Open = Close at bottom of range. Bearish reversal potential." };
  return { name: "Doji", type: "neutral", confidence: 50, description: "Indecision candle. Potential reversal or continuation." };
}

// ---------------------------------------------------------------------------
// Two-candle patterns
// ---------------------------------------------------------------------------

/** Engulfing Bar — second candle body fully engulfs first. */
export function detectEngulfing(prev: Candle, curr: Candle): DetectedPattern | null {
  const body1 = Math.abs(prev.close - prev.open);
  const body2 = Math.abs(curr.close - curr.open);
  if (body1 === 0) return null;

  // Bullish: red → larger green
  if (prev.close < prev.open && curr.close > curr.open &&
      curr.open < prev.close && curr.close > prev.open) {
    return {
      name: "Bullish Engulfing",
      type: "bullish",
      confidence: Math.min(100, Math.round((body2 / body1) * 45)),
      description: "Buyers overwhelmed sellers. Strong bullish reversal.",
    };
  }
  // Bearish: green → larger red
  if (prev.close > prev.open && curr.close < curr.open &&
      curr.open > prev.close && curr.close < prev.open) {
    return {
      name: "Bearish Engulfing",
      type: "bearish",
      confidence: Math.min(100, Math.round((body2 / body1) * 45)),
      description: "Sellers overwhelmed buyers. Strong bearish reversal.",
    };
  }
  return null;
}

/** Inside Bar (Harami) — baby candle contained within mother candle. */
export function detectInsideBar(mother: Candle, baby: Candle): DetectedPattern | null {
  if (baby.high <= mother.high && baby.low >= mother.low) {
    const bodyMother = Math.abs(mother.close - mother.open);
    const bodyBaby = Math.abs(baby.close - baby.open);
    const ratio = bodyMother > 0 ? bodyBaby / bodyMother : 1;
    return {
      name: "Inside Bar",
      type: "neutral",
      confidence: Math.min(100, Math.round((1 - ratio) * 90)),
      description: "Consolidation within prior candle's range. Breakout pending.",
    };
  }
  return null;
}

/** Tweezers Top / Bottom — two candles sharing same high/low. */
export function detectTweezers(prev: Candle, curr: Candle): DetectedPattern | null {
  const tol = Math.max(prev.high, curr.high) * 0.0002;
  if (Math.abs(prev.high - curr.high) < tol && prev.close > prev.open && curr.close < curr.open)
    return { name: "Tweezers Top", type: "bearish", confidence: 62, description: "Double rejection at same high. Bearish reversal signal." };
  if (Math.abs(prev.low - curr.low) < tol && prev.close < prev.open && curr.close > curr.open)
    return { name: "Tweezers Bottom", type: "bullish", confidence: 62, description: "Double rejection at same low. Bullish reversal signal." };
  return null;
}

// ---------------------------------------------------------------------------
// Three-candle patterns
// ---------------------------------------------------------------------------

/** Morning Star / Evening Star — three-candle reversal. */
export function detectStar(c1: Candle, c2: Candle, c3: Candle): DetectedPattern | null {
  const body1 = Math.abs(c1.close - c1.open);
  const body2 = Math.abs(c2.close - c2.open);

  // Morning Star (bullish)
  if (c1.close < c1.open &&
      body2 < body1 * 0.5 &&
      c3.close > c3.open &&
      c3.close > (c1.open + c1.close) / 2) {
    return { name: "Morning Star", type: "bullish", confidence: 78, description: "Three-candle bottom reversal. Strong bullish signal." };
  }
  // Evening Star (bearish)
  if (c1.close > c1.open &&
      body2 < body1 * 0.5 &&
      c3.close < c3.open &&
      c3.close < (c1.open + c1.close) / 2) {
    return { name: "Evening Star", type: "bearish", confidence: 78, description: "Three-candle top reversal. Strong bearish signal." };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main detector — runs all patterns on the last few candles
// ---------------------------------------------------------------------------

export function detectAllPatterns(candles: Candle[]): DetectedPattern[] {
  if (!candles || candles.length < 2) return [];
  const patterns: DetectedPattern[] = [];
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  // Single-candle
  const pin = detectPinBar(last);        if (pin)  patterns.push(pin);
  const doji = detectDoji(last);         if (doji) patterns.push(doji);

  // Two-candle
  const eng  = detectEngulfing(prev, last);  if (eng)  patterns.push(eng);
  const ib   = detectInsideBar(prev, last);  if (ib)   patterns.push(ib);
  const twz  = detectTweezers(prev, last);   if (twz)  patterns.push(twz);

  // Three-candle
  if (candles.length >= 3) {
    const star = detectStar(candles[candles.length - 3], prev, last);
    if (star) patterns.push(star);
  }

  // Sort by confidence descending
  return patterns.sort((a, b) => b.confidence - a.confidence);
}
