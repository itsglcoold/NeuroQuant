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
  individualAnalyses: ModelOutput[];
  mergedKeyLevels: {
    support: number[];
    resistance: number[];
  };
  summary: string;
  disclaimer: string;
  generatedAt: string;
  expiresAt: string;
}

export interface ChartAnalysisResult {
  detectedSymbol: string | null;
  detectedTimeframe: string | null;
  patterns: string[];
  direction: "bullish" | "bearish" | "neutral";
  confidence: number; // 1-10
  supportLevels: number[];
  resistanceLevels: number[];
  indicators: string[];
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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelUsed?: string;
  createdAt: string;
}
