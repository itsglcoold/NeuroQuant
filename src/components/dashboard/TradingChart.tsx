"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from "lightweight-charts";
import { OHLCVBar } from "@/types/market";

// Check if forex markets are open (Sun 21:00 – Fri 21:00 UTC)
function isMarketOpen(): boolean {
  const now = new Date();
  const d = now.getUTCDay(), h = now.getUTCHours();
  if (d === 6) return false;
  if (d === 0 && h < 21) return false;
  if (d === 5 && h >= 21) return false;
  return true;
}

interface TradingChartProps {
  symbol: string;
  height?: number;
}

type Interval = "1min" | "5min" | "15min" | "1h" | "4h" | "1day" | "1week" | "1month";

const INTERVALS: { label: string; value: Interval; group: "scalp" | "swing" }[] = [
  { label: "1m", value: "1min", group: "scalp" },
  { label: "5m", value: "5min", group: "scalp" },
  { label: "15m", value: "15min", group: "scalp" },
  { label: "1H", value: "1h", group: "scalp" },
  { label: "4H", value: "4h", group: "scalp" },
  { label: "1D", value: "1day", group: "swing" },
  { label: "1W", value: "1week", group: "swing" },
  { label: "1M", value: "1month", group: "swing" },
];

const INTRADAY_INTERVALS: Interval[] = ["1min", "5min", "15min", "1h", "4h"];

// How often to fetch full candle data (seconds)
const CANDLE_REFRESH: Record<Interval, number> = {
  "1min": 60,
  "5min": 60,
  "15min": 120,
  "1h": 300,
  "4h": 300,
  "1day": 300,
  "1week": 600,
  "1month": 600,
};

// How often to tick the last candle with live price (seconds)
// Keep conservative to stay within EODHD daily API limits
const TICK_RATE = 30;

function transformData(bars: OHLCVBar[], isIntraday: boolean): {
  candles: CandlestickData<Time>[];
  volume: HistogramData<Time>[];
} {
  const candles: CandlestickData<Time>[] = [];
  const volume: HistogramData<Time>[] = [];

  const sortedBars = [...bars].sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );

  for (const bar of sortedBars) {
    const time = isIntraday
      ? (Math.floor(new Date(bar.datetime).getTime() / 1000) as unknown as Time)
      : (bar.datetime.split(" ")[0] as Time);

    candles.push({ time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    volume.push({
      time,
      value: bar.volume,
      color: bar.close >= bar.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
    });
  }

  return { candles, volume };
}

function calcSMA(candles: CandlestickData<Time>[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    result.push({ time: candles[i].time, value: sum / period });
  }
  return result;
}

export function TradingChart({ symbol, height = 400 }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50Ref = useRef<ISeriesApi<"Line"> | null>(null);

  // Store last candle so we can update it with ticks
  const lastCandleRef = useRef<CandlestickData<Time> | null>(null);

  const [interval, setInterval] = useState<Interval>("1day");
  const [loading, setLoading] = useState(true);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const getChartColors = useCallback(() => {
    return {
      background: isDark ? "#0a0a0a" : "#ffffff",
      text: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)",
      grid: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
      border: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      crosshair: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
      upColor: "#22c55e",
      downColor: "#ef4444",
      sma20: "#3b82f6",
      sma50: "#f59e0b",
    };
  }, [isDark]);

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;

    const colors = getChartColors();
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: colors.crosshair, width: 1, style: 3 },
        horzLine: { color: colors.crosshair, width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: INTRADAY_INTERVALS.includes(interval),
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderDownColor: colors.downColor,
      borderUpColor: colors.upColor,
      wickDownColor: colors.downColor,
      wickUpColor: colors.upColor,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const sma20Series = chart.addSeries(LineSeries, {
      color: colors.sma20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const sma50Series = chart.addSeries(LineSeries, {
      color: colors.sma50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sma20Ref.current = sma20Series;
    sma50Ref.current = sma50Series;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Update theme
  useEffect(() => {
    if (!chartRef.current) return;
    const colors = getChartColors();

    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });
  }, [isDark, getChartColors]);

  // =============================================
  // CANDLE DATA: Full fetch on load + interval
  // =============================================
  useEffect(() => {
    let cancelled = false;

    async function fetchCandles() {
      setLoading(true);
      try {
        const outputsizeMap: Record<Interval, number> = {
          "1min": 120, "5min": 120, "15min": 96, "1h": 120,
          "4h": 90, "1day": 90, "1week": 52, "1month": 24,
        };
        const outputsize = outputsizeMap[interval];
        const res = await fetch(
          `/api/market-data?symbol=${encodeURIComponent(symbol)}&type=timeseries&interval=${interval}&outputsize=${outputsize}`
        );
        if (cancelled) return;

        if (res.ok) {
          const json = await res.json();
          const bars: OHLCVBar[] = json.data;
          if (bars?.length && !cancelled) {
            const isIntraday = INTRADAY_INTERVALS.includes(interval);
            const { candles, volume } = transformData(bars, isIntraday);
            const sma20Data = calcSMA(candles, 20);
            const sma50Data = calcSMA(candles, 50);

            chartRef.current?.applyOptions({
              timeScale: { timeVisible: isIntraday, secondsVisible: false },
            });

            candleSeriesRef.current?.setData(candles);
            volumeSeriesRef.current?.setData(volume);
            sma20Ref.current?.setData(sma20Data);
            sma50Ref.current?.setData(sma50Data);

            // Store last candle for live ticking
            lastCandleRef.current = candles[candles.length - 1] || null;

            chartRef.current?.timeScale().fitContent();
          }
        }
      } catch (e) {
        console.error("Chart data fetch error:", e);
      }
      if (!cancelled) setLoading(false);
    }

    fetchCandles();

    // Periodically refetch full candle data (skip when markets closed)
    const candleTimer = globalThis.setInterval(() => {
      if (!cancelled && isMarketOpen()) fetchCandles();
    }, CANDLE_REFRESH[interval] * 1000);

    return () => {
      cancelled = true;
      clearInterval(candleTimer);
    };
  }, [symbol, interval]);

  // =============================================
  // LIVE TICK: Fetch real-time price every few seconds
  // and update the last candle so the chart "moves"
  // =============================================
  useEffect(() => {
    let cancelled = false;

    async function tickPrice() {
      // Skip API calls when markets are closed (weekend)
      if (!isMarketOpen()) return;
      try {
        const res = await fetch(
          `/api/market-data?symbol=${encodeURIComponent(symbol)}&type=quote`
        );
        if (cancelled || !res.ok) return;

        const json = await res.json();
        const price = json.data?.price;
        if (typeof price !== "number" || price <= 0) return;

        setLivePrice(price);

        // Update the last candle in-place
        const lastCandle = lastCandleRef.current;
        if (lastCandle && candleSeriesRef.current) {
          const updated: CandlestickData<Time> = {
            ...lastCandle,
            close: price,
            high: Math.max(lastCandle.high, price),
            low: Math.min(lastCandle.low, price),
          };
          candleSeriesRef.current.update(updated);
          lastCandleRef.current = updated;
        }
      } catch {
        // Silent fail — will retry next tick
      }
    }

    // Start ticking immediately
    tickPrice();
    const tickTimer = globalThis.setInterval(tickPrice, TICK_RATE * 1000);

    return () => {
      cancelled = true;
      clearInterval(tickTimer);
    };
  }, [symbol]);

  return (
    <div className="relative">
      {/* Timeframe selector */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        <span className="mr-1.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Scalp</span>
        {INTERVALS.filter((iv) => iv.group === "scalp").map((iv) => (
          <button
            key={iv.value}
            onClick={() => setInterval(iv.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              interval === iv.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {iv.label}
          </button>
        ))}

        <div className="mx-2 h-4 w-px bg-border" />

        <span className="mr-1.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Swing</span>
        {INTERVALS.filter((iv) => iv.group === "swing").map((iv) => (
          <button
            key={iv.value}
            onClick={() => setInterval(iv.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              interval === iv.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {iv.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-blue-500 rounded" />
            SMA 20
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-amber-500 rounded" />
            SMA 50
          </span>
          {livePrice !== null && (
            <span className="flex items-center gap-1 tabular-nums font-medium text-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={containerRef}
        className="rounded-lg overflow-hidden border border-border"
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 top-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            Loading chart...
          </div>
        </div>
      )}
    </div>
  );
}
