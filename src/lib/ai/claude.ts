import Anthropic from "@anthropic-ai/sdk";
import { FundamentalAnalysis, ModelOutput } from "@/types/analysis";
import { fundamentalAnalysisPrompt, technicalAnalysisPrompt, buildMarketDataContext, DISCLAIMER, type TradingStyle } from "./prompts";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function analyzeTechnical(marketData: {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timeSeries: Array<{ datetime: string; open: number; high: number; low: number; close: number }>;
  indicators: {
    rsi: number | null;
    macd: { macd: number; signal: number; histogram: number } | null;
    sma20: number | null;
    sma50: number | null;
    bollingerBands: { upper: number; middle: number; lower: number } | null;
  };
  tradingStyle?: TradingStyle;
}): Promise<ModelOutput> {
  const context = buildMarketDataContext(marketData);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: technicalAnalysisPrompt("claude", marketData.symbol, marketData.tradingStyle),
    messages: [
      {
        role: "user",
        content: `Analyze the following market data:\n\n${context}`,
      },
    ],
  });

  let content =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown code block wrappers if present
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    content = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(content);
    const validDirections = ["bullish", "bearish", "neutral"];
    return {
      model: "Analyst Gamma",
      sentiment: typeof parsed.sentiment === "number" ? Math.min(100, Math.max(-100, parsed.sentiment)) : 0,
      direction: validDirections.includes(parsed.direction) ? parsed.direction : "neutral",
      confidence: typeof parsed.confidence === "number" ? Math.min(100, Math.max(0, parsed.confidence)) : 0,
      keyLevels: {
        support: Array.isArray(parsed.keyLevels?.support) ? parsed.keyLevels.support : [],
        resistance: Array.isArray(parsed.keyLevels?.resistance) ? parsed.keyLevels.resistance : [],
      },
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "No reasoning provided.",
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      model: "Analyst Gamma",
      sentiment: 0,
      direction: "neutral",
      confidence: 0,
      keyLevels: { support: [], resistance: [] },
      reasoning: "Analysis could not be parsed. Raw response: " + content.slice(0, 500),
      timestamp: new Date().toISOString(),
    };
  }
}

export async function analyzeFundamental(
  symbol: string,
  context: string
): Promise<FundamentalAnalysis> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: fundamentalAnalysisPrompt(),
    messages: [
      {
        role: "user",
        content: `Provide a fundamental analysis for ${symbol}.\n\nContext and recent data:\n${context}`,
      },
    ],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(content);
    return {
      symbol,
      ...parsed,
      disclaimer: DISCLAIMER,
    };
  } catch {
    return {
      symbol,
      macroOutlook: "Analysis unavailable",
      keyFactors: [],
      risks: [],
      sentiment: "neutral",
      analysis: content.slice(0, 1000),
      sources: [],
      disclaimer: DISCLAIMER,
    };
  }
}

export async function streamChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string
) {
  return client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: systemPrompt,
    messages,
  });
}
