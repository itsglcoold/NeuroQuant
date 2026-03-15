import { NextRequest, NextResponse } from "next/server";
import { analyzeChart } from "@/lib/ai/qwen";
import { getSymbolTradingStyle, MARKETS } from "@/lib/market/symbols";

export const runtime = 'edge';

// Edge-compatible base64 encoding (no Buffer dependency)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Normalize AI-detected symbol to our canonical format.
 * AI may return "EURUSD", "eurusd", "Eur/Usd", "XAUUSD", "NAS100", etc.
 * We need to match against our MARKETS list which uses "EUR/USD", "XAU/USD", etc.
 */
function normalizeSymbol(raw: string): string {
  // Strip parenthetical descriptions: "XAU/USD (Gold Spot / U.S. Dollar)" → "XAU/USD"
  let cleaned = raw.trim().replace(/\s*\(.*\)$/, "").trim().toUpperCase().replace(/\s+/g, "");

  // Already in our format? (e.g. "EUR/USD")
  const direct = MARKETS.find((m) => m.symbol.toUpperCase() === cleaned);
  if (direct) return direct.symbol;

  // Strip slashes/dashes/dots and try matching without separators (e.g. "EURUSD" → "EUR/USD")
  const stripped = cleaned.replace(/[/\-_.]/g, "");
  const match = MARKETS.find((m) => m.symbol.replace(/[/\-_.]/g, "").toUpperCase() === stripped);
  if (match) return match.symbol;

  // Common aliases — covers TradingView naming, broker names, common abbreviations
  const ALIASES: Record<string, string> = {
    // Gold
    "GOLD": "XAU/USD", "XAUUSD": "XAU/USD", "GOLDSPOT": "XAU/USD",
    "GOLDSPOTUS DOLLAR": "XAU/USD", "GOLDSPOT/USDOLLAR": "XAU/USD",
    // Silver
    "SILVER": "XAG/USD", "XAGUSD": "XAG/USD", "SILVERSPOT": "XAG/USD",
    "SILVER/USDOLLAR": "XAG/USD",
    // Oil
    "OIL": "CL", "CRUDEOIL": "CL", "WTI": "CL", "USOIL": "CL",
    "WTICRUDEOIL": "CL", "CFDSONWTICRUDEOIL": "CL", "CRUDE": "CL",
    // NASDAQ
    "NAS100": "IXIC", "NASDAQ": "IXIC", "NASDAQ100": "IXIC", "NDX": "IXIC", "NQ": "IXIC",
    "USNAS100": "IXIC", "US100": "IXIC", "USTEC": "IXIC", "USTEC100": "IXIC",
    "NASDAQCOMPOSITE": "IXIC",
    // S&P 500
    "SP500": "SPX", "SPX500": "SPX", "US500": "SPX", "S&P500": "SPX",
    "SP500INDEX": "SPX", "S&P500INDEX": "SPX",
    // DXY
    "DOLLARINDEX": "DXY", "USDX": "DXY", "USDOLLARINDEX": "DXY",
  };
  if (ALIASES[stripped]) return ALIASES[stripped];

  // Fuzzy: check if any alias is contained in the stripped string
  // Handles "CFDSONWTICRUDEOIL" or "USNASDAQ100INDEX" etc.
  for (const [alias, symbol] of Object.entries(ALIASES)) {
    if (stripped.includes(alias) && alias.length >= 4) return symbol;
  }

  // Return original if no match
  return raw.trim();
}

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

    // Convert to base64 (edge-compatible)
    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    // Analyze with Qwen VL
    const analysis = await analyzeChart(base64);

    // Normalize detected symbol and match trading style
    if (analysis.detectedSymbol) {
      analysis.detectedSymbol = normalizeSymbol(analysis.detectedSymbol);
      const style = getSymbolTradingStyle(analysis.detectedSymbol);
      if (style) {
        analysis.detectedStyle = style.key as "scalping" | "daytrading" | "swing";
      }
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Chart analysis error:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze chart";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
