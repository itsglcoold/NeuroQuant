import { NextRequest } from "next/server";
import { getPrice, getTimeSeries, getTechnicalIndicators } from "@/lib/market/eodhd";
import { analyzeTechnical as deepseekAnalyze } from "@/lib/ai/deepseek";
import { analyzeTechnical as qwenAnalyze } from "@/lib/ai/qwen";
import { analyzeTechnical as claudeAnalyze } from "@/lib/ai/claude";
import { calculateConsensus } from "@/lib/ai/consensus";
import type { ModelOutput } from "@/types/analysis";

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  let body: { symbol?: string; tier?: string; interval?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { symbol, tier = "free", interval = "1day" } = body;

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

        // Adjust bar count based on interval — shorter intervals need more bars
        const barCount = ["1min", "5min"].includes(interval) ? 60 : ["15min", "1h"].includes(interval) ? 40 : 30;

        // Fetch market data — use allSettled so one failure doesn't crash everything
        const [priceResult, timeSeriesResult, indicatorsResult] = await Promise.allSettled([
          getPrice(symbol),
          getTimeSeries(symbol, interval, barCount),
          getTechnicalIndicators(symbol, "1day"),
        ]);

        if (priceResult.status === "rejected") {
          throw new Error(`Failed to fetch price for ${symbol}`);
        }

        const price = priceResult.value;
        const timeSeries = timeSeriesResult.status === "fulfilled" ? timeSeriesResult.value : [];
        const indicators = indicatorsResult.status === "fulfilled" ? indicatorsResult.value : {
          rsi: null, macd: null, sma20: null, sma50: null, ema12: null, ema26: null, bollingerBands: null,
        };

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
        const consensus = calculateConsensus(modelOutputs, interval);

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
