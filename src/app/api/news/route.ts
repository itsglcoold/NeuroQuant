import { NextRequest, NextResponse } from "next/server";
import { getMarketNews } from "@/lib/market/news";

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol") || undefined;
  const category = searchParams.get("category") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const articles = await getMarketNews({
      symbol,
      category,
      limit: Math.min(limit, 50),
    });

    return NextResponse.json({ data: articles });
  } catch (error) {
    console.error("News API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
