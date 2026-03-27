export interface ModelOutput {
  model: string;
  sentiment: number; // -100 (very bearish) to +100 (very bullish)
  direction: "bullish" | "bearish" | "neutral";
  confidence: number; // 0 to 100
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  reasoning: string;
  timestamp: string;
}

export interface ConsensusResult {
  consensusDirection: "bullish" | "bearish" | "neutral";
  consensusScore: number; // -100 to +100
  agreementLevel: "high" | "medium" | "low";
  sentimentLabel: string; // e.g. "Strong Bullish Momentum", "Moderate Bearish"
  probabilityScore: number; // 0-100 probability alignment %
  individualAnalyses: ModelOutput[];
  mergedKeyLevels: {
    support: number[];
    resistance: number[];
  };
  summary: string;
  disclaimer: string;
  timeframe?: string; // e.g. "1min", "5min", "1day"
  generatedAt: string;
  expiresAt: string;
}

export interface ChartAnalysisResult {
  detectedSymbol: string | null;
  detectedTimeframe: string | null;
  detectedStyle?: "scalping" | "daytrading" | "swing";
  patterns: string[];
  direction: "bullish" | "bearish" | "neutral";
  confidence: number; // 0-100
  supportLevels: number[];
  resistanceLevels: number[];
  indicators: string[];
  marketStructure?: string | null;
  keyLevelAbove?: number | null;
  keyLevelBelow?: number | null;
  stopLossZone?: string | null;
  targetZones?: string[];
  scalpOutlook?: string | null;
  swingOutlook?: string | null;
  analysis: string;
  disclaimer: string;
}

export interface FundamentalAnalysis {
  symbol: string;
  macroOutlook: string;
  keyFactors: string[];
  risks: string[];
  sentiment: "bullish" | "bearish" | "neutral";
  analysis: string;
  sources: string[];
  disclaimer: string;
}

export interface MarketSuggestion {
  symbol: string;
  name: string;
  emoji: string;
  category: string;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  sentiment: number;
  sentimentLabel: string;
  probabilityAlignment: number;
  timeframe: string;
  reasoning: string;
  keyLevel: number;
  // Enrichment fields — added from OHLC analysis after AI screening
  candlestickPattern?: {
    name: string;
    type: "bullish" | "bearish" | "neutral";
    confidence: number;
    description: string;
  };
  confluenceScore?: number;
  confluenceGrade?: "Excellent" | "Good" | "Moderate" | "Poor";
  marketRegime?: string;
  adx?: number;
  recommendation?: string;
}

export interface SuggestionRow {
  key: string;
  label: string;
  subtitle: string;
  timeframeFocus: string;
  badgeColor: string;
  suggestions: MarketSuggestion[];
}

export interface SuggestionsResponse {
  rows: SuggestionRow[];
  suggestions: MarketSuggestion[];  // backwards compat: all combined
  generatedAt: string;
  expiresAt: string;
  disclaimer: string;
  marketsScanned: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelUsed?: string;
  createdAt: string;
}
