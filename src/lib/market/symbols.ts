import { MarketCategory, MarketSymbol } from "@/types/market";

export const MARKETS: MarketSymbol[] = [
  // Metals
  { symbol: "XAU/USD", name: "Gold", category: "metals", icon: "Au", emoji: "\u{1F947}" },
  { symbol: "XAG/USD", name: "Silver", category: "metals", icon: "Ag", emoji: "\u{1F948}" },

  // Energy
  { symbol: "CL", name: "Crude Oil (WTI)", category: "energy", icon: "OIL", emoji: "\u{1F6E2}\uFE0F" },

  // Indices
  { symbol: "DXY", name: "US Dollar Index", category: "indices", icon: "DX", emoji: "\u{1F4B5}" },
  { symbol: "SPX", name: "S&P 500", category: "indices", icon: "SP", emoji: "\u{1F4C8}" },
  { symbol: "IXIC", name: "NASDAQ 100", category: "indices", icon: "NQ", emoji: "\u{1F4B9}" },

  // Forex — Majors
  { symbol: "EUR/USD", name: "EUR/USD", category: "forex", icon: "EU", emoji: "\u{1F1EA}\u{1F1FA}" },
  { symbol: "GBP/USD", name: "GBP/USD", category: "forex", icon: "GB", emoji: "\u{1F1EC}\u{1F1E7}" },
  { symbol: "USD/JPY", name: "USD/JPY", category: "forex", icon: "JP", emoji: "\u{1F1EF}\u{1F1F5}" },
  { symbol: "USD/CHF", name: "USD/CHF", category: "forex", icon: "CH", emoji: "\u{1F1E8}\u{1F1ED}" },
  { symbol: "AUD/USD", name: "AUD/USD", category: "forex", icon: "AU", emoji: "\u{1F1E6}\u{1F1FA}" },
  { symbol: "NZD/USD", name: "NZD/USD", category: "forex", icon: "NZ", emoji: "\u{1F1F3}\u{1F1FF}" },
  { symbol: "USD/CAD", name: "USD/CAD", category: "forex", icon: "CA", emoji: "\u{1F1E8}\u{1F1E6}" },

  // Forex — JPY Crosses
  { symbol: "EUR/JPY", name: "EUR/JPY", category: "forex", icon: "EJ", emoji: "\u{1F1EA}\u{1F1FA}" },
  { symbol: "GBP/JPY", name: "GBP/JPY", category: "forex", icon: "GJ", emoji: "\u{1F1EC}\u{1F1E7}" },
  { symbol: "AUD/JPY", name: "AUD/JPY", category: "forex", icon: "AJ", emoji: "\u{1F1E6}\u{1F1FA}" },
  { symbol: "NZD/JPY", name: "NZD/JPY", category: "forex", icon: "NJ", emoji: "\u{1F1F3}\u{1F1FF}" },
  { symbol: "CAD/JPY", name: "CAD/JPY", category: "forex", icon: "CJ", emoji: "\u{1F1E8}\u{1F1E6}" },

  // Forex — GBP Crosses
  { symbol: "EUR/GBP", name: "EUR/GBP", category: "forex", icon: "EG", emoji: "\u{1F1EA}\u{1F1FA}" },
  { symbol: "GBP/AUD", name: "GBP/AUD", category: "forex", icon: "GA", emoji: "\u{1F1EC}\u{1F1E7}" },
  { symbol: "GBP/NZD", name: "GBP/NZD", category: "forex", icon: "GN", emoji: "\u{1F1EC}\u{1F1E7}" },
  { symbol: "GBP/CAD", name: "GBP/CAD", category: "forex", icon: "GC", emoji: "\u{1F1EC}\u{1F1E7}" },
  { symbol: "GBP/CHF", name: "GBP/CHF", category: "forex", icon: "GH", emoji: "\u{1F1EC}\u{1F1E7}" },

  // Forex — AUD/NZD Crosses
  { symbol: "AUD/CAD", name: "AUD/CAD", category: "forex", icon: "AC", emoji: "\u{1F1E6}\u{1F1FA}" },
  { symbol: "AUD/CHF", name: "AUD/CHF", category: "forex", icon: "AH", emoji: "\u{1F1E6}\u{1F1FA}" },
  { symbol: "AUD/NZD", name: "AUD/NZD", category: "forex", icon: "AN", emoji: "\u{1F1E6}\u{1F1FA}" },
  { symbol: "EUR/AUD", name: "EUR/AUD", category: "forex", icon: "EA", emoji: "\u{1F1EA}\u{1F1FA}" },
  { symbol: "NZD/CAD", name: "NZD/CAD", category: "forex", icon: "NC", emoji: "\u{1F1F3}\u{1F1FF}" },
];

export const MARKET_CATEGORIES = {
  metals: { label: "Metals", description: "Gold & Silver" },
  energy: { label: "Energy", description: "Crude Oil" },
  indices: { label: "Indices", description: "DXY, S&P 500 & NASDAQ 100" },
  forex: { label: "Forex", description: "Currency Pairs" },
} as const;

export const CATEGORY_COLORS: Record<
  MarketCategory,
  { bg: string; text: string; border: string; dot: string }
> = {
  metals: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-600 dark:text-yellow-500",
    border: "border-l-yellow-500",
    dot: "bg-yellow-500",
  },
  energy: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-500",
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
  },
  indices: {
    bg: "bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-500",
    border: "border-l-indigo-500",
    dot: "bg-indigo-500",
  },
  forex: {
    bg: "bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-500",
    border: "border-l-blue-500",
    dot: "bg-blue-500",
  },
} as const;

export function getMarketBySymbol(symbol: string): MarketSymbol | undefined {
  return MARKETS.find((m) => m.symbol === symbol);
}

export function getMarketsByCategory(category: string): MarketSymbol[] {
  return MARKETS.filter((m) => m.category === category);
}

export function getMarketEmoji(symbol: string): string {
  const market = MARKETS.find((m) => m.symbol === symbol);
  return market?.emoji ?? "";
}

/** Fixed asset groups for AI Market Research screening */
export const SCREENING_ROWS = [
  {
    key: "scalping" as const,
    label: "Scalping",
    subtitle: "The Hit-and-Run",
    timeframeFocus: "5m / 15m",
    badgeColor: "red",
    symbols: ["IXIC", "SPX", "XAU/USD", "DXY", "EUR/USD"],
  },
  {
    key: "daytrading" as const,
    label: "Day Trading",
    subtitle: "The Daily Trader",
    timeframeFocus: "15m / 1H",
    badgeColor: "blue",
    symbols: ["GBP/USD", "USD/JPY", "CL", "EUR/JPY", "GBP/JPY"],
  },
  {
    key: "swing" as const,
    label: "Swing Trading",
    subtitle: "The Trend Follower",
    timeframeFocus: "4H / Daily",
    badgeColor: "amber",
    symbols: ["XAG/USD", "AUD/USD", "USD/CAD", "NZD/USD", "USD/CHF"],
  },
] as const;

/** Extra crosses mapped to a trading style (not in SCREENING_ROWS but still get a badge + style) */
const CROSS_STYLE_MAP: Record<string, "daytrading" | "swing"> = {
  // JPY crosses → Day Trading
  "AUD/JPY": "daytrading",
  "NZD/JPY": "daytrading",
  "CAD/JPY": "daytrading",
  // All other crosses → Swing Trading
  "EUR/GBP": "swing",
  "GBP/AUD": "swing",
  "GBP/NZD": "swing",
  "GBP/CAD": "swing",
  "GBP/CHF": "swing",
  "AUD/CAD": "swing",
  "AUD/CHF": "swing",
  "AUD/NZD": "swing",
  "EUR/AUD": "swing",
  "NZD/CAD": "swing",
};

const STYLE_META: Record<string, { label: string; badgeColor: string; timeframeFocus: string }> = {
  scalping:    { label: "Scalping",       badgeColor: "red",   timeframeFocus: "5m / 15m" },
  daytrading:  { label: "Day Trading",    badgeColor: "blue",  timeframeFocus: "15m / 1H" },
  swing:       { label: "Swing Trading",  badgeColor: "amber", timeframeFocus: "4H / Daily" },
};

/** Lookup: symbol → trading style info (covers SCREENING_ROWS + extra crosses) */
export function getSymbolTradingStyle(symbol: string): { key: string; label: string; badgeColor: string; timeframeFocus: string } | undefined {
  // First check SCREENING_ROWS
  for (const row of SCREENING_ROWS) {
    if ((row.symbols as readonly string[]).includes(symbol)) {
      return { key: row.key, label: row.label, badgeColor: row.badgeColor, timeframeFocus: row.timeframeFocus };
    }
  }
  // Then check extra crosses
  const crossStyle = CROSS_STYLE_MAP[symbol];
  if (crossStyle) {
    const meta = STYLE_META[crossStyle];
    return { key: crossStyle, ...meta };
  }
  return undefined;
}
