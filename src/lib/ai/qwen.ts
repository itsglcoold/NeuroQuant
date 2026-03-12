import OpenAI from "openai";
import { ModelOutput, ChartAnalysisResult } from "@/types/analysis";
import { technicalAnalysisPrompt, chartAnalysisPrompt, buildMarketDataContext, DISCLAIMER } from "./prompts";

const client = new OpenAI({
  baseURL: "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.QWEN_API_KEY,
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
}): Promise<ModelOutput> {
  const context = buildMarketDataContext(marketData);

  const response = await client.chat.completions.create({
    model: "qwen3.5-plus",
    messages: [
      { role: "system", content: technicalAnalysisPrompt("qwen", marketData.symbol) },
      { role: "user", content: `Analyze the following market data:\n\n${context}` },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(content);
    return {
      model: "Analyst Beta",
      sentiment: parsed.sentiment,
      direction: parsed.direction,
      confidence: parsed.confidence,
      keyLevels: parsed.keyLevels,
      reasoning: parsed.reasoning,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      model: "Analyst Beta",
      sentiment: 0,
      direction: "neutral",
      confidence: 0,
      keyLevels: { support: [], resistance: [] },
      reasoning: "Analysis could not be parsed. Raw response: " + content.slice(0, 500),
      timestamp: new Date().toISOString(),
    };
  }
}

export async function analyzeChart(imageBase64: string): Promise<ChartAnalysisResult> {
  const response = await client.chat.completions.create({
    model: "qwen3.5-plus",
    messages: [
      { role: "system", content: chartAnalysisPrompt() },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
          {
            type: "text",
            text: "Analyze this financial chart. Identify patterns, trends, support/resistance levels, and any visible indicators.",
          },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(content);
    return {
      ...parsed,
      disclaimer: DISCLAIMER,
    };
  } catch {
    return {
      detectedSymbol: null,
      detectedTimeframe: null,
      patterns: [],
      direction: "neutral",
      confidence: 1,
      supportLevels: [],
      resistanceLevels: [],
      indicators: [],
      analysis: "Chart analysis could not be completed. " + content.slice(0, 500),
      disclaimer: DISCLAIMER,
    };
  }
}
