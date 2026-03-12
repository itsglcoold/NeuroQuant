import OpenAI from "openai";
import { ModelOutput } from "@/types/analysis";
import { technicalAnalysisPrompt, buildMarketDataContext } from "./prompts";

function getClient() {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
  });
}

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
}): Promise<ModelOutput> {
  const context = buildMarketDataContext(marketData);

  const response = await getClient().chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: technicalAnalysisPrompt("deepseek", marketData.symbol) },
      { role: "user", content: `Analyze the following market data:\n\n${context}` },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(content);
    return {
      model: "Analyst Alpha",
      sentiment: parsed.sentiment,
      direction: parsed.direction,
      confidence: parsed.confidence,
      keyLevels: parsed.keyLevels,
      reasoning: parsed.reasoning,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      model: "Analyst Alpha",
      sentiment: 0,
      direction: "neutral",
      confidence: 0,
      keyLevels: { support: [], resistance: [] },
      reasoning: "Analysis could not be parsed. Raw response: " + content.slice(0, 500),
      timestamp: new Date().toISOString(),
    };
  }
}
