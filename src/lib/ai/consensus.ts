import { ModelOutput, ConsensusResult } from "@/types/analysis";
import { DISCLAIMER } from "./prompts";

export function calculateConsensus(outputs: ModelOutput[]): ConsensusResult {
  if (outputs.length === 0) {
    return emptyConsensus();
  }

  // Weighted average sentiment: weight by each model's confidence
  const totalConfidence = outputs.reduce((sum, o) => sum + o.confidence, 0);
  const weightedSentiment =
    totalConfidence > 0
      ? outputs.reduce((sum, o) => sum + o.sentiment * o.confidence, 0) /
        totalConfidence
      : 0;

  // Agreement level: do models point the same direction?
  const directions = outputs.map((o) => o.direction);
  const allSame = directions.every((d) => d === directions[0]);
  const hasMixed =
    directions.includes("bullish") && directions.includes("bearish");

  const agreementLevel: "high" | "medium" | "low" = allSame
    ? "high"
    : hasMixed
      ? "low"
      : "medium";

  // Consensus direction based on weighted sentiment
  const consensusDirection =
    weightedSentiment > 20
      ? "bullish"
      : weightedSentiment < -20
        ? "bearish"
        : "neutral";

  // Merge key levels from all models
  const mergedKeyLevels = mergeKeyLevels(outputs);

  // Generate summary
  const summary = generateSummary(
    outputs,
    consensusDirection,
    weightedSentiment,
    agreementLevel
  );

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours

  return {
    consensusDirection,
    consensusScore: Math.round(weightedSentiment),
    agreementLevel,
    individualAnalyses: outputs,
    mergedKeyLevels,
    summary,
    disclaimer: DISCLAIMER,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function mergeKeyLevels(
  outputs: ModelOutput[]
): { support: number[]; resistance: number[] } {
  const allSupport = outputs.flatMap((o) => o.keyLevels.support);
  const allResistance = outputs.flatMap((o) => o.keyLevels.resistance);

  // Remove duplicates and sort
  const support = [...new Set(allSupport)].sort((a, b) => b - a).slice(0, 3);
  const resistance = [...new Set(allResistance)]
    .sort((a, b) => a - b)
    .slice(0, 3);

  return { support, resistance };
}

function generateSummary(
  outputs: ModelOutput[],
  direction: string,
  score: number,
  agreement: string
): string {
  const modelNames = outputs.map((o) => o.model).join(" and ");
  const avgConfidence = Math.round(
    outputs.reduce((sum, o) => sum + o.confidence, 0) / outputs.length
  );

  let directionText = "a neutral stance";
  if (direction === "bullish") directionText = "a bullish outlook";
  if (direction === "bearish") directionText = "a bearish outlook";

  let agreementText = "are in agreement";
  if (agreement === "low") agreementText = "have diverging views";
  if (agreement === "medium") agreementText = "show partial agreement";

  return `${modelNames} ${agreementText}, suggesting ${directionText} with a consensus score of ${score}/100 and average confidence of ${avgConfidence}%. ${outputs.map((o) => `${o.model}: ${o.direction} (confidence: ${o.confidence}%)`).join(". ")}.`;
}

function emptyConsensus(): ConsensusResult {
  return {
    consensusDirection: "neutral",
    consensusScore: 0,
    agreementLevel: "low",
    individualAnalyses: [],
    mergedKeyLevels: { support: [], resistance: [] },
    summary: "No analysis data available.",
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  };
}
