import { NextRequest } from "next/server";
import { getPrice, getTimeSeries, getTechnicalIndicators } from "@/lib/market/eodhd";
import { analyzeTechnical as deepseekAnalyze } from "@/lib/ai/deepseek";
import { analyzeTechnical as qwenAnalyze } from "@/lib/ai/qwen";
import { analyzeTechnical as claudeAnalyze } from "@/lib/ai/claude";
import { calculateConsensus } from "@/lib/ai/consensus";
import type { ModelOutput } from "@/types/analysis";


export async function POST(request: NextRequest) {
  const { symbol, tier = "free" } = await request.json();

  if (!symbol) {
    return new Response(JSON.stringify({ error: "Symbol required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`));
      }

      try {
        // Step 1: Fetch market data in parallel
        send("status", { message: "Fetching live market data…" });

        const [price, timeSeries, indicators] = await Promise.all([
          getPrice(symbol),
          getTimeSeries(symbol, "1day", 30),
          getTechnicalIndicators(symbol, "1day"),
        ]);

        const marketData = {
          symbol,
          price: price.price,
          change: price.change,
          changePercent: price.changePercent,
          timeSeries: timeSeries.map((bar) => ({
            datetime: bar.datetime,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          })),
          indicators: {
            rsi: indicators.rsi,
            macd: indicators.macd,
            sma20: indicators.sma20,
            sma50: indicators.sma50,
            bollingerBands: indicators.bollingerBands,
          },
        };

        send("market_data", { price, indicators });

        // Step 2: Run AI analysts — stream each result as it arrives
        const modelOutputs: ModelOutput[] = [];

        if (tier === "free") {
          // Free tier: single analyst
          send("status", { message: "Analyst Alpha is analyzing…" });
          const alphaResult = await deepseekAnalyze(marketData);
          modelOutputs.push(alphaResult);
          send("analyst", { index: 0, result: alphaResult });
        } else {
          // Pro/Premium: triple AI — race them and stream as each finishes
          send("status", { message: "3 AI analysts are analyzing…" });

          const analysts = [
            { name: "Alpha", fn: deepseekAnalyze },
            { name: "Beta", fn: qwenAnalyze },
            { name: "Gamma", fn: claudeAnalyze },
          ];

          // Create promises that send results as they resolve
          const promises = analysts.map(async (analyst, index) => {
            try {
              const result = await analyst.fn(marketData);
              modelOutputs.push(result);
              send("analyst", { index, result });
              return result;
            } catch (err) {
              console.error(`${analyst.name} failed:`, err);
              const fallback: ModelOutput = {
                model: `Analyst ${analyst.name}`,
                sentiment: 0,
                direction: "neutral",
                confidence: 0, // 0 confidence → consensus redistributes weight to other models
                keyLevels: { support: [], resistance: [] },
                reasoning: "Analysis unavailable — model timed out. Remaining analysts have been reweighted for consensus.",
                timestamp: new Date().toISOString(),
              };
              modelOutputs.push(fallback);
              send("analyst", { index, result: fallback });
              return fallback;
            }
          });

          await Promise.all(promises);
        }

        // Step 3: Calculate consensus
        const consensus = calculateConsensus(modelOutputs);

        send("consensus", {
          symbol,
          price,
          indicators,
          consensus,
          analystsUsed: modelOutputs.length,
        });

        send("done", null);
      } catch (error) {
        console.error("Technical analysis error:", error);
        send("error", { message: "Failed to generate analysis" });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
