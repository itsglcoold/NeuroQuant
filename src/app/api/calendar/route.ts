import { NextRequest, NextResponse } from "next/server";
import { getEconomicCalendar, type ImpactLevel } from "@/lib/market/economic-calendar";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const country = searchParams.get("country") || undefined;
  const startDate = searchParams.get("start_date") || undefined;
  const endDate = searchParams.get("end_date") || undefined;
  const impact = searchParams.get("impact") || undefined;

  try {
    let events = await getEconomicCalendar({
      country,
      startDate,
      endDate,
    });

    // Filter by impact level if provided
    if (impact && impact !== "all") {
      const impactFilter = impact.toLowerCase() as ImpactLevel;
      events = events.filter((e) => e.impact === impactFilter);
    }

    return NextResponse.json({ events, source: process.env.EODHD_API_KEY ? "api" : "mock" });
  } catch (error) {
    console.error("Economic calendar error:", error);
    return NextResponse.json(
      { error: "Failed to fetch economic calendar data" },
      { status: 500 }
    );
  }
}
