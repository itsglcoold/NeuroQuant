export interface RiskScoreInput {
  /** Reward:Risk ratio — e.g. 2.0 means TP is 2× the SL distance */
  rrRatio: number;
  /** How strongly the AI analysts agree on direction */
  agreementLevel: "high" | "medium" | "low";
  /** How many ATRs the SL is away from entry. null if ATR unavailable. */
  slDistanceInATR: number | null;
}

export interface RiskScoreResult {
  score: number; // 1–10
  grade: string;
  color: "green" | "blue" | "amber" | "red";
  explanation: string;
}

/**
 * Calculate a 1–10 setup quality score for beginners.
 * Higher = better trade setup.
 */
export function calculateRiskScore(input: RiskScoreInput): RiskScoreResult {
  let score = 5;
  const parts: string[] = [];

  // R:R ratio — most impactful factor (±3 / -2)
  if (input.rrRatio >= 3) {
    score += 3;
    parts.push("excellent R:R (1:3+)");
  } else if (input.rrRatio >= 2) {
    score += 2;
    parts.push("good R:R (1:2)");
  } else if (input.rrRatio >= 1.5) {
    score += 1;
    parts.push("acceptable R:R (1:1.5)");
  } else {
    score -= 2;
    parts.push("poor R:R — risk exceeds reward");
  }

  // Analyst agreement (±2 / -1)
  if (input.agreementLevel === "high") {
    score += 2;
    parts.push("all 3 analysts agree");
  } else if (input.agreementLevel === "medium") {
    score += 1;
    parts.push("2 of 3 analysts agree");
  } else {
    score -= 1;
    parts.push("analysts disagree");
  }

  // SL breathing room relative to ATR (±1)
  if (input.slDistanceInATR !== null) {
    if (input.slDistanceInATR >= 1.0) {
      score += 1;
      parts.push("SL has good breathing room");
    } else if (input.slDistanceInATR < 0.5) {
      score -= 1;
      parts.push("SL may be too tight for this volatility");
    }
  }

  const finalScore = Math.min(10, Math.max(1, Math.round(score)));

  let grade: string;
  let color: RiskScoreResult["color"];
  if (finalScore >= 8) {
    grade = "Excellent Setup";
    color = "green";
  } else if (finalScore >= 6) {
    grade = "Good Setup";
    color = "blue";
  } else if (finalScore >= 4) {
    grade = "Risky Setup";
    color = "amber";
  } else {
    grade = "Poor Setup";
    color = "red";
  }

  return { score: finalScore, grade, color, explanation: parts.join(" · ") };
}
