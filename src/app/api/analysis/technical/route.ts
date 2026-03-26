import { NextRequest } from "next/server";
import { getPrice, getTimeSeries, getTechnicalIndicators } from "@/lib/market/eodhd";
import { analyzeTechnical as deepseekAnalyze } from "@/lib/ai/deepseek";
import { analyzeTechnical as qwenAnalyze } from "@/lib/ai/qwen";
import { analyzeTechnical as claudeAnalyze } from "@/lib/ai/claude";
import { calculateConsensus } from "@/lib/ai/consensus";
import { withTimeout, withRetry } from "@/lib/ai/timeout";
import { checkAnalysisRateLimit } from "@/lib/ratelimit";
import type { ModelOutput } from "@/types/analysis";

/** Per-analyst timeout: 25 seconds max per AI call */
const ANALYST_TIMEOUT_MS = 25_000;

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  // Auth + rate limit check (tier read from DB, not trusted from body)
  const rateLimit = await checkAnalysisRateLimit();
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: rateLimit.reason }),
      { status: rateLimit.reason === "Unauthorized" ? 401 : 429,
        headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { symbol?: string; interval?: string; tradingStyle?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Use real tier from DB — ignore any tier the client may have sent
  const { symbol, interval = "1day", tradingStyle } = body;
  const tier = rateLimit.tier;

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
        // Map short intervals to "1h" for indicators — 1min/5min/15min indicators are too noisy
        const indicatorInterval = ["1min", "5min", "15min"].includes(interval) ? "1h" : "1day";

        const [priceResult, timeSeriesResult, indicatorsResult] = await Promise.allSettled([
          getPrice(symbol),
          getTimeSeries(symbol, interval, barCount),
          getTechnicalIndicators(symbol, indicatorInterval),
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
          tradingStyle: tradingStyle as "scalping" | "daytrading" | "swing" | undefined,
        };

        send("market_data", { price, indicators, timeSeries: marketData.timeSeries });

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
          // Each analyst gets a timeout + 1 retry to ensure all 3 complete
          let successCount = 0;

          const promises = analysts.map(async (analyst, index) => {
            try {
              const result = await withRetry(
                () => withTimeout(analyst.fn(marketData), ANALYST_TIMEOUT_MS, analyst.name),
                1,     // 1 retry on failure
                500,   // 500ms delay before retry
                analyst.name
              );
              modelOutputs.push(result);
              successCount++;
              send("analyst", { index, result });
              return result;
            } catch (err) {
              console.error(`${analyst.name} failed after retry:`, err);
              const fallback: ModelOutput = {
                model: `Analyst ${analyst.name}`,
                sentiment: 0,
                direction: "neutral",
                confidence: 0, // 0 confidence → consensus redistributes weight to other models
                keyLevels: { support: [], resistance: [] },
                reasoning: "Analysis unavailable — model timed out after retry. Remaining analysts have been reweighted for consensus.",
                timestamp: new Date().toISOString(),
              };
              modelOutputs.push(fallback);
              send("analyst", { index, result: fallback, failed: true });
              return fallback;
            }
          });

          await Promise.all(promises);

          // Report how many analysts succeeded
          send("analysts_complete", { total: 3, success: successCount, failed: 3 - successCount });
        }

        // Step 3: Calculate consensus
        const consensus = calculateConsensus(modelOutputs, interval, price.price);

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
