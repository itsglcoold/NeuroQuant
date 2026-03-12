export interface MarketSymbol {
  symbol: string;
  name: string;
  category: MarketCategory;
  icon: string;
  emoji: string;
}

export type MarketCategory = "metals" | "energy" | "forex" | "indices";

export interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export interface OHLCVBar {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  } | null;
}
