/**
 * Confluence Score Calculator
 *
 * Three-factor model (Candlestick Trading Bible methodology):
 *   Factor 1 — Trend    (40% weight): Is there a clear directional trend?
 *   Factor 2 — Level    (35% weight): Is price at a meaningful S/R level?
 *   Factor 3 — Signal   (25% weight): Is there a pattern confirming the trade?
 */

export interface ConfluenceInput {
  // Factor 1 — Trend
  adx: number;
  isTrending: boolean;
  trendDirection: "bullish" | "bearish" | "neutral";
  multiTfAlignment: number; // 0–100 — % of timeframes in agreement

  // Factor 2 — Level
  atSupport: boolean;
  atResistance: boolean;
  levelStrength: number; // 0–100 — how strong is the nearest level

  // Factor 3 — Signal
  pattern: {
    name: string;
    type: "bullish" | "bearish" | "neutral";
    confidence: number; // 0–100
  } | null;
  atrRatio: number; // current ATR / average ATR (>1.5 = volatile spike)
}

export interface ConfluenceResult {
  score: number; // 0–100
  breakdown: { trend: number; level: number; signal: number };
  grade: "Excellent" | "Good" | "Moderate" | "Poor";
  recommendation: string;
}

export function calculateConfluenceScore(input: ConfluenceInput): ConfluenceResult {
  // ── Factor 1: Trend (0–100) ─────────────────────────────────────────────
  let trendScore = 45; // neutral baseline
  if (input.isTrending) {
    trendScore = 65 + Math.min(25, input.adx / 2); // ADX 25 → 77.5, ADX 50 → 90
  }
  if (input.multiTfAlignment >= 67) trendScore += 8;
  if (input.multiTfAlignment >= 90) trendScore += 5;
  trendScore = Math.min(100, Math.max(0, Math.round(trendScore)));

  // ── Factor 2: Level (0–100) ──────────────────────────────────────────────
  let levelScore = 40;
  if (input.atSupport)    levelScore += 20;
  if (input.atResistance) levelScore += 20;
  levelScore += Math.min(20, Math.round(input.levelStrength / 5));
  if (input.atSupport && input.atResistance) levelScore += 5; // confluence zone bonus
  levelScore = Math.min(100, Math.max(0, levelScore));

  // ── Factor 3: Signal (0–100) ─────────────────────────────────────────────
  let signalScore = 50;
  if (input.pattern) {
    const alignsWithTrend =
      input.pattern.type !== "neutral" &&
      input.trendDirection !== "neutral" &&
      input.pattern.type === input.trendDirection;
    signalScore += alignsWithTrend ? 20 : (input.pattern.type === "neutral" ? 5 : -10);
    signalScore += Math.round((input.pattern.confidence - 50) * 0.4);
  }
  if (input.atrRatio > 1.5) signalScore -= 15; // volatile market — noise risk
  if (input.atrRatio < 0.7) signalScore += 5;  // calm — cleaner signal
  signalScore = Math.min(100, Math.max(0, Math.round(signalScore)));

  // ── Weighted total ───────────────────────────────────────────────────────
  const score = Math.round(trendScore * 0.4 + levelScore * 0.35 + signalScore * 0.25);

  let grade: ConfluenceResult["grade"];
  let recommendation: string;
  if (score >= 80) {
    grade = "Excellent";
    recommendation = "High-probability setup. Strong confluence of trend, level, and signal.";
  } else if (score >= 65) {
    grade = "Good";
    recommendation = "Good setup. Take with standard risk.";
  } else if (score >= 50) {
    grade = "Moderate";
    recommendation = "Moderate setup. Consider reducing size or waiting for clearer confluence.";
  } else {
    grade = "Poor";
    recommendation = "Weak setup. Wait for better conditions.";
  }

  return {
    score,
    breakdown: { trend: trendScore, level: levelScore, signal: signalScore },
    grade,
    recommendation,
  };
}
