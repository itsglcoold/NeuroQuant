import { NextRequest, NextResponse } from "next/server";
import { analyzeChart } from "@/lib/ai/qwen";


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("chart") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No chart image provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: PNG, JPG, WebP" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Analyze with Qwen VL
    const analysis = await analyzeChart(base64);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Chart analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze chart" },
      { status: 500 }
    );
  }
}
