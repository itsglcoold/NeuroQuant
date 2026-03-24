import OpenAI from "openai";
import { ModelOutput } from "@/types/analysis";
import { technicalAnalysisPrompt, buildMarketDataContext, type TradingStyle } from "./prompts";

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
  tradingStyle?: TradingStyle;
}): Promise<ModelOutput> {
  const context = buildMarketDataContext(marketData);

  const response = await getClient().chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: technicalAnalysisPrompt("deepseek", marketData.symbol, marketData.tradingStyle) },
      { role: "user", content: `Analyze the following market data:\n\n${context}` },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  let content = response.choices[0]?.message?.content || "";

  // Strip markdown code block wrappers if present (DeepSeek often wraps JSON in ```json ... ```)
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    content = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(content);
    const validDirections = ["bullish", "bearish", "neutral"];
    return {
      model: "Analyst Alpha",
      sentiment: typeof parsed.sentiment === "number" ? parsed.sentiment : 0,
      direction: validDirections.includes(parsed.direction) ? parsed.direction : "neutral",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      keyLevels: {
        support: Array.isArray(parsed.keyLevels?.support) ? parsed.keyLevels.support : [],
        resistance: Array.isArray(parsed.keyLevels?.resistance) ? parsed.keyLevels.resistance : [],
      },
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "No reasoning provided.",
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
