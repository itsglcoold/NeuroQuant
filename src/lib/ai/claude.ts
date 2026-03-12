import Anthropic from "@anthropic-ai/sdk";
import { FundamentalAnalysis } from "@/types/analysis";
import { fundamentalAnalysisPrompt, DISCLAIMER } from "./prompts";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

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
