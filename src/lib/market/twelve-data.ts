import { MarketPrice, OHLCVBar, TechnicalIndicators } from "@/types/market";

const BASE_URL = "https://api.twelvedata.com";
const API_KEY = process.env.TWELVE_DATA_API_KEY;

async function fetchTwelveData(endpoint: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams({ ...params, apikey: API_KEY || "" });
  const url = `${BASE_URL}/${endpoint}?${searchParams}`;

  const response = await fetch(url, { next: { revalidate: 60 } }); // Cache 1 minute
  if (!response.ok) {
    throw new Error(`Twelve Data API error: ${response.status}`);
  }
  return response.json();
}

export async function getPrice(symbol: string): Promise<MarketPrice> {
  const data = await fetchTwelveData("quote", { symbol });

  return {
    symbol: data.symbol,
    price: parseFloat(data.close),
    change: parseFloat(data.change),
    changePercent: parseFloat(data.percent_change),
    high: parseFloat(data.high),
    low: parseFloat(data.low),
    open: parseFloat(data.open),
    previousClose: parseFloat(data.previous_close),
    timestamp: new Date(data.datetime).getTime(),
  };
}

export async function getPrices(symbols: string[]): Promise<MarketPrice[]> {
  const symbolString = symbols.join(",");
  const data = await fetchTwelveData("quote", { symbol: symbolString });

  // If single symbol, data is an object; if multiple, it's keyed by symbol
  if (symbols.length === 1) {
    return [parseQuote(data)];
  }

  return Object.values(data).map((quote: unknown) => parseQuote(quote as Record<string, string>));
}

function parseQuote(data: Record<string, string>): MarketPrice {
  return {
    symbol: data.symbol,
    price: parseFloat(data.close),
    change: parseFloat(data.change),
    changePercent: parseFloat(data.percent_change),
    high: parseFloat(data.high),
    low: parseFloat(data.low),
    open: parseFloat(data.open),
    previousClose: parseFloat(data.previous_close),
    timestamp: new Date(data.datetime).getTime(),
  };
}

export async function getTimeSeries(
  symbol: string,
  interval: string = "1day",
  outputSize: number = 30
): Promise<OHLCVBar[]> {
  const data = await fetchTwelveData("time_series", {
    symbol,
    interval,
    outputsize: outputSize.toString(),
  });

  if (!data.values) return [];

  return data.values.map((bar: Record<string, string>) => ({
    datetime: bar.datetime,
    open: parseFloat(bar.open),
    high: parseFloat(bar.high),
    low: parseFloat(bar.low),
    close: parseFloat(bar.close),
    volume: parseInt(bar.volume) || 0,
  }));
}

export async function getTechnicalIndicators(
  symbol: string,
  interval: string = "1day"
): Promise<TechnicalIndicators> {
  const [rsiData, macdData, sma20Data, sma50Data, bbData] = await Promise.allSettled([
    fetchTwelveData("rsi", { symbol, interval, time_period: "14" }),
    fetchTwelveData("macd", { symbol, interval }),
    fetchTwelveData("sma", { symbol, interval, time_period: "20" }),
    fetchTwelveData("sma", { symbol, interval, time_period: "50" }),
    fetchTwelveData("bbands", { symbol, interval }),
  ]);

  return {
    rsi: rsiData.status === "fulfilled" && rsiData.value.values?.[0]
      ? parseFloat(rsiData.value.values[0].rsi)
      : null,
    macd: macdData.status === "fulfilled" && macdData.value.values?.[0]
      ? {
          macd: parseFloat(macdData.value.values[0].macd),
          signal: parseFloat(macdData.value.values[0].macd_signal),
          histogram: parseFloat(macdData.value.values[0].macd_hist),
        }
      : null,
    sma20: sma20Data.status === "fulfilled" && sma20Data.value.values?.[0]
      ? parseFloat(sma20Data.value.values[0].sma)
      : null,
    sma50: sma50Data.status === "fulfilled" && sma50Data.value.values?.[0]
      ? parseFloat(sma50Data.value.values[0].sma)
      : null,
    ema12: null, // Calculate from price data if needed
    ema26: null,
    bollingerBands: bbData.status === "fulfilled" && bbData.value.values?.[0]
      ? {
          upper: parseFloat(bbData.value.values[0].upper_band),
          middle: parseFloat(bbData.value.values[0].middle_band),
          lower: parseFloat(bbData.value.values[0].lower_band),
        }
      : null,
  };
}
