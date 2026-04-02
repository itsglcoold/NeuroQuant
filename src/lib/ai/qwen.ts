import OpenAI from "openai";
import { ModelOutput, ChartAnalysisResult } from "@/types/analysis";
import { technicalAnalysisPrompt, chartAnalysisPrompt, buildMarketDataContext, DISCLAIMER, type TradingStyle } from "./prompts";

function getClient() {
  return new OpenAI({
    baseURL: "https://ws-cs1xxjuyessure89.eu-central-1.maas.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.QWEN_API_KEY || "",
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
    model: "qwen3-max-2025-09-23", // most powerful general-purpose Qwen model
    messages: [
      { role: "system", content: technicalAnalysisPrompt("qwen", marketData.symbol, marketData.tradingStyle) },
      { role: "user", content: `Analyze the following market data:\n\n${context}` },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  let content = response.choices[0]?.message?.content || "";

  // Strip markdown code block wrappers if present
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    content = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(content);
    const validDirections = ["bullish", "bearish", "neutral"];
    return {
      model: "Analyst Beta",
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
  const response = await getClient().chat.completions.create({
    model: "qwen3.5-plus-2026-02-15", // native vision-language, most capable multimodal
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
            text: "Perform a complete professional technical analysis of this financial chart. Follow all 9 steps in your instructions.",
          },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 3000,
  });

  let content = response.choices[0]?.message?.content || "";

  // Strip markdown code block wrappers if present
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    content = codeBlockMatch[1].trim();
  }

  // If still not clean JSON, try to extract the first { ... } object
  if (!content.startsWith("{")) {
    const jsonObjMatch = content.match(/\{[\s\S]*\}/);
    if (jsonObjMatch) {
      content = jsonObjMatch[0];
    }
  }

  // Fix truncated JSON — try to close open brackets/braces
  function tryRepairJson(raw: string): string {
    let s = raw.trim();
    // Count open/close braces and brackets
    const openBraces = (s.match(/\{/g) || []).length;
    const closeBraces = (s.match(/\}/g) || []).length;
    const openBrackets = (s.match(/\[/g) || []).length;
    const closeBrackets = (s.match(/\]/g) || []).length;
    // Remove trailing comma if present
    s = s.replace(/,\s*$/, "");
    // Close any unclosed strings
    const quoteCount = (s.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) s += '"';
    // Close arrays then objects
    for (let i = 0; i < openBrackets - closeBrackets; i++) s += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) s += "}";
    return s;
  }

  try {
    const parsed = JSON.parse(content);
    return {
      ...parsed,
      disclaimer: DISCLAIMER,
    };
  } catch {
    // Try repairing truncated JSON
    try {
      const repaired = tryRepairJson(content);
      const parsed = JSON.parse(repaired);
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
}
