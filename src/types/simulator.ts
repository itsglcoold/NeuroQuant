// NeuroQuant Simulator — Paper Trading Types

export interface PaperTrade {
  id: string;
  user_id: string;
  symbol: string;
  side: "long" | "short";
  entry_price: number;
  sl_price: number;
  tp_price: number;
  status: "open" | "closed";
  close_price?: number;
  result_pnl?: number;
  closed_at?: string;
  analysis_snapshot?: AnalysisSnapshot;
  created_at: string;
}

export interface AnalysisSnapshot {
  consensusDirection: "bullish" | "bearish" | "neutral";
  consensusScore: number;
  sentimentLabel: string;
  mergedKeyLevels: {
    support: number[];
    resistance: number[];
  };
  // Metadata saved at trade open time (optional — not present on older trades)
  atrPips?: number;
  atrLabel?: string;     // "p" | "pts"
  regime?: string;       // "trending" | "ranging" | "choppy"
  riskScore?: number;    // 1–10
  rrRatio?: number;      // e.g. 2.0
  // Candlestick pattern at entry
  entryPattern?: string;             // e.g. "Bearish Engulfing"
  entryPatternType?: "bullish" | "bearish" | "neutral";
  entryPatternConfidence?: number;   // 0–100
  // Confluence score (trend × level × signal)
  confluenceScore?: number;          // 0–100
  confluenceGrade?: "Excellent" | "Good" | "Moderate" | "Poor";
}

export interface SimulatorStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  accuracy: number;
  totalPnl: number;
  activeTrades: number;
  virtualBalance: number;
}

export const SIMULATOR_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  premium: Infinity,
};

export const INITIAL_VIRTUAL_BALANCE = 10000;
