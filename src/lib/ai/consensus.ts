import { ModelOutput, ConsensusResult } from "@/types/analysis";
import { DISCLAIMER } from "./prompts";

// Model weights for weighted consensus — DeepSeek & Qwen lead on technical,
// Claude acts as strategic filter / sanity check.
const MODEL_WEIGHTS: Record<string, number> = {
  "Analyst Alpha": 0.4,  // DeepSeek — quantitative data, indicators
  "Analyst Beta":  0.4,  // Qwen — pattern recognition, price action
  "Analyst Gamma": 0.2,  // Claude — macro context, sanity check
};

function getWeight(model: string): number {
  return MODEL_WEIGHTS[model] ?? (1 / 3); // fallback equal weight
}

// Sentiment strength label based on consensus score (-100 to +100)
function getSentimentLabel(score: number): string {
  if (score >= 60) return "Strong Bullish Momentum";
  if (score >= 30) return "Moderate Bullish";
  if (score >= 10) return "Slightly Bullish";
  if (score > -10) return "Neutral";
  if (score > -30) return "Slightly Bearish";
  if (score > -60) return "Moderate Bearish";
  return "Strong Bearish Exhaustion";
}

// Probability alignment score: how much do the analysts overlap (0–100%)
function getProbabilityScore(outputs: ModelOutput[]): number {
  if (outputs.length <= 1) return outputs[0]?.confidence || 0;

  const validOutputs = outputs.filter((o) => o.confidence > 0);
  if (validOutputs.length === 0) return 0;

  // Directional agreement factor (0–1)
  const directions = validOutputs.map((o) => o.direction);
  const allSame = directions.every((d) => d === directions[0]);
  const hasMixed = directions.includes("bullish") && directions.includes("bearish");
  const directionFactor = allSame ? 1.0 : hasMixed ? 0.4 : 0.7;

  // Weighted confidence
  const rawWeights = validOutputs.map((o) => getWeight(o.model));
  const rawTotal = rawWeights.reduce((s, w) => s + w, 0);
  const normWeights = rawWeights.map((w) => w / rawTotal);
  const weightedConfidence = validOutputs.reduce(
    (sum, o, i) => sum + o.confidence * normWeights[i], 0
  );

  return Math.round(weightedConfidence * directionFactor);
}

export function calculateConsensus(outputs: ModelOutput[], timeframe: string = "1day"): ConsensusResult {
  if (outputs.length === 0) {
    return emptyConsensus();
  }

  // Filter out failed models (confidence === 0) for scoring
  const validOutputs = outputs.filter((o) => o.confidence > 0);
  const scoringOutputs = validOutputs.length > 0 ? validOutputs : outputs;

  // Redistribute weights if a model failed — divide its share among survivors
  const rawWeights = scoringOutputs.map((o) => getWeight(o.model));
  const rawTotal = rawWeights.reduce((s, w) => s + w, 0);
  const normWeights = rawWeights.map((w) => w / rawTotal); // always sums to 1

  // Weighted sentiment using model weights × confidence
  const weightedSentiment = scoringOutputs.reduce(
    (sum, o, i) => sum + o.sentiment * normWeights[i] * (o.confidence / 100),
    0
  ) / scoringOutputs.reduce(
    (sum, o, i) => sum + normWeights[i] * (o.confidence / 100),
    0
  ) || 0;

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

  // Sentiment label & probability score
  const sentimentLabel = getSentimentLabel(Math.round(weightedSentiment));
  const probabilityScore = getProbabilityScore(outputs);

  // Merge key levels from all models
  const mergedKeyLevels = mergeKeyLevels(outputs);

  // Generate summary
  const summary = generateSummary(
    outputs,
    consensusDirection,
    weightedSentiment,
    agreementLevel,
    sentimentLabel,
    probabilityScore
  );

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours

  return {
    consensusDirection,
    consensusScore: Math.round(weightedSentiment),
    agreementLevel,
    sentimentLabel,
    probabilityScore,
    individualAnalyses: outputs,
    mergedKeyLevels,
    summary,
    timeframe,
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
  agreement: string,
  sentimentLabel: string,
  probabilityScore: number
): string {
  const validOutputs = outputs.filter((o) => o.confidence > 0);
  const names = validOutputs.map((o) => o.model);
  const modelNames =
    names.length <= 2
      ? names.join(" and ")
      : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;

  let agreementText = "are aligned";
  if (agreement === "low") agreementText = "have diverging views";
  if (agreement === "medium") agreementText = "show partial alignment";

  return `${modelNames} ${agreementText}. Sentiment: ${sentimentLabel} (score ${Math.round(score)}/100, probability alignment ${Math.round(probabilityScore)}%).\n${outputs.map((o) => `**${o.model}**: ${o.direction} (${Math.round(o.confidence)}%)`).join(".\n")}.`;
}

function emptyConsensus(): ConsensusResult {
  return {
    consensusDirection: "neutral",
    consensusScore: 0,
    agreementLevel: "low",
    sentimentLabel: "Neutral",
    probabilityScore: 0,
    individualAnalyses: [],
    mergedKeyLevels: { support: [], resistance: [] },
    summary: "No analysis data available.",
    timeframe: "1day",
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  };
}
