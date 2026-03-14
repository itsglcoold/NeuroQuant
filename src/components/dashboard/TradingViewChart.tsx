"use client";

import { useEffect, useRef, useState, memo } from "react";

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  interval?: string; // TradingView interval: "1", "5", "15", "60", "240", "D"
}

// Data sources / brokers available in TradingView
const DATA_SOURCES = [
  { id: "FX", label: "FXCM" },
  { id: "OANDA", label: "OANDA" },
  { id: "SAXO", label: "Saxo Bank" },
  { id: "PEPPERSTONE", label: "Pepperstone" },
] as const;

type DataSourceId = (typeof DATA_SOURCES)[number]["id"];

// Available indicators the user can toggle on/off
const AVAILABLE_INDICATORS = [
  { id: "EMA", label: "EMA", tvStudy: "STD;EMA", defaultOn: true },
  { id: "SMA", label: "SMA", tvStudy: "STD;SMA", defaultOn: false },
  { id: "RSI", label: "RSI", tvStudy: "STD;RSI", defaultOn: true },
  { id: "MACD", label: "MACD", tvStudy: "STD;MACD", defaultOn: false },
  { id: "BB", label: "Bollinger", tvStudy: "STD;Bollinger_Bands", defaultOn: false },
] as const;

type IndicatorId = (typeof AVAILABLE_INDICATORS)[number]["id"];

// Chart styles
const CHART_STYLES = [
  { id: 1, label: "Candles" },
  { id: 8, label: "Heikin Ashi" },
  { id: 3, label: "Area" },
] as const;

// Map our app symbols to TradingView symbols per data source
function buildTvSymbolMap(source: DataSourceId): Record<string, string> {
  // These symbols are source-independent — use broker CFD symbols
  // (exchange indices like SP:SPX / INDEX:DXY are blocked in embed widgets)
  const baseMap: Record<string, string> = {
    "CL": "TVC:USOIL",
    "DXY": "CAPITALCOM:DXY",
    "SPX": "OANDA:SPX500USD",
    "IXIC": "OANDA:NAS100USD",
  };

  // Metals: use OANDA as reliable fallback for all sources
  const metalPrefix: Record<DataSourceId, string> = {
    FX: "OANDA",
    OANDA: "OANDA",
    SAXO: "SAXO",
    PEPPERSTONE: "PEPPERSTONE",
  };
  const mp = metalPrefix[source];
  const metalMap: Record<string, string> = {
    "XAU/USD": `${mp}:XAUUSD`,
    "XAG/USD": `${mp}:XAGUSD`,
  };

  const forexPairs = [
    "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD", "USD/CAD",
    "EUR/JPY", "GBP/JPY", "AUD/JPY", "NZD/JPY", "CAD/JPY",
    "EUR/GBP", "GBP/AUD", "GBP/NZD", "GBP/CAD", "GBP/CHF",
    "AUD/CAD", "AUD/CHF", "AUD/NZD", "EUR/AUD", "NZD/CAD",
  ];

  const forexMap: Record<string, string> = {};
  for (const pair of forexPairs) {
    const clean = pair.replace("/", "");
    forexMap[pair] = `${source}:${clean}`;
  }

  return { ...baseMap, ...metalMap, ...forexMap };
}

function getTvSymbol(symbol: string, source: DataSourceId): string {
  const map = buildTvSymbolMap(source);
  return map[symbol] || `${source}:${symbol.replace("/", "")}`;
}

function TradingViewChartInner({ symbol, height = 500, interval: intervalProp = "D" }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dataSource, setDataSource] = useState<DataSourceId>("FX");
  const [chartStyle, setChartStyle] = useState<number>(1);
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorId>>(
    () => new Set(AVAILABLE_INDICATORS.filter((i) => i.defaultOn).map((i) => i.id))
  );

  function toggleIndicator(id: IndicatorId) {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any previous widget
    container.innerHTML = "";

    const tvSymbol = getTvSymbol(symbol, dataSource);

    // Build studies list from active indicators
    const studies = AVAILABLE_INDICATORS
      .filter((ind) => activeIndicators.has(ind.id))
      .map((ind) => ind.tvStudy);

    // Create the widget container
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = `${height}px`;
    widgetContainer.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    widgetContainer.appendChild(widgetDiv);

    container.appendChild(widgetContainer);

    // Dynamically load and execute the TradingView script
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";

    script.textContent = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: intervalProp,
      timezone: "Etc/UTC",
      theme: "dark",
      style: String(chartStyle),
      locale: "en",
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      details: false,
      hotlist: false,
      calendar: false,
      studies,
      support_host: "https://www.tradingview.com",
    });

    widgetContainer.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [symbol, height, dataSource, chartStyle, activeIndicators, intervalProp]);

  return (
    <div className="space-y-0">
      {/* Toolbar: Data Source + Chart Style + Indicators */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-t-lg border border-b-0 border-border bg-[#1e222d] px-3 py-1.5">
        {/* Data Source */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-zinc-500">Source:</span>
          {DATA_SOURCES.map((src) => (
            <button
              key={src.id}
              onClick={() => setDataSource(src.id)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                dataSource === src.id
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-zinc-200"
              }`}
            >
              {src.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-zinc-700" />

        {/* Chart Style */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-zinc-500">Style:</span>
          {CHART_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setChartStyle(style.id)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                chartStyle === style.id
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-zinc-200"
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-zinc-700" />

        {/* Indicator Toggles */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-zinc-500">Indicators:</span>
          {AVAILABLE_INDICATORS.map((ind) => (
            <button
              key={ind.id}
              onClick={() => toggleIndicator(ind.id)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                activeIndicators.has(ind.id)
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-zinc-200"
              }`}
            >
              {ind.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-b-lg overflow-hidden border border-border bg-[#131722]">
        <div ref={containerRef} style={{ height: `${height}px`, width: "100%" }} />
      </div>
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartInner);
