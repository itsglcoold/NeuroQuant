import { NextRequest, NextResponse } from "next/server";
import { getEconomicCalendar } from "@/lib/market/economic-calendar";
import OpenAI from "openai";


function getDeepseek() {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
  });
}

export async function GET(request: NextRequest) {
  try {
    // Get today's date
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Fetch today's events
    const events = await getEconomicCalendar({
      startDate: today,
      endDate: today,
    });

    // Filter to high-impact events only
    const highImpact = events.filter((e) => e.impact === "high");

    if (highImpact.length === 0) {
      return NextResponse.json({
        summary:
          "No high-impact economic events scheduled for today. Markets may trade on technicals and sentiment.",
        eventCount: 0,
      });
    }

    // Build event list for the prompt
    const eventList = highImpact
      .map(
        (e) =>
          `- ${e.time || "TBD"} | ${e.country} | ${e.title} | Forecast: ${e.forecast || "N/A"} | Previous: ${e.previous || "N/A"}${e.actual ? ` | Actual: ${e.actual}` : ""}`
      )
      .join("\n");

    const prompt = `You are a concise financial news analyst. Summarize today's high-impact economic events in exactly 3 short sentences. Focus on: (1) what the key events are, (2) which currencies/markets are most likely affected, (3) the overall risk level for traders today.

Today's High-Impact Events:
${eventList}

Rules:
- Maximum 3 sentences, keep each under 30 words
- Use plain language, no jargon
- Do NOT use any markdown formatting (no **, no *, no # etc.) — output plain text only
- Never give investment advice or buy/sell recommendations
- State facts and potential market reactions only
- End with the risk level: Low / Moderate / Elevated / High`;

    const deepseek = getDeepseek();
    const completion = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() ||
      "Unable to generate summary.";

    return NextResponse.json({
      summary,
      eventCount: highImpact.length,
    });
  } catch (error) {
    console.error("Calendar summary error:", error);
    return NextResponse.json(
      {
        summary:
          "Unable to generate AI summary at this time. Check the calendar below for today's events.",
        eventCount: 0,
      },
      { status: 200 } // Return 200 so the UI doesn't show error state
    );
  }
}
