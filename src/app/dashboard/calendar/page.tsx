"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CalendarDays, Clock, Loader2, AlertCircle, Info, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EconomicEvent, ImpactLevel } from "@/lib/market/economic-calendar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimeRange = "today" | "tomorrow" | "this_week" | "next_week" | "this_month" | "custom";
type ImpactFilter = "all" | ImpactLevel;

const COUNTRIES = [
  { code: "ALL", label: "All" },
  { code: "US", label: "US" },
  { code: "EU", label: "EU" },
  { code: "UK", label: "UK" },
  { code: "JP", label: "JP" },
  { code: "CH", label: "CH" },
  { code: "AU", label: "AU" },
] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}",
  EU: "\u{1F1EA}\u{1F1FA}",
  UK: "\u{1F1EC}\u{1F1E7}",
  JP: "\u{1F1EF}\u{1F1F5}",
  CH: "\u{1F1E8}\u{1F1ED}",
  AU: "\u{1F1E6}\u{1F1FA}",
  CA: "\u{1F1E8}\u{1F1E6}",
  NZ: "\u{1F1F3}\u{1F1FF}",
  CN: "\u{1F1E8}\u{1F1F3}",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(ref: Date): Date {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonthEnd(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return d;
}

function getDateRange(range: TimeRange, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date();
  if (range === "custom" && customStart) {
    return { start: customStart, end: customEnd || customStart };
  }
  if (range === "today") {
    const today = formatDate(now);
    return { start: today, end: today };
  }
  if (range === "tomorrow") {
    const tomorrow = formatDate(addDays(now, 1));
    return { start: tomorrow, end: tomorrow };
  }
  if (range === "this_week") {
    const ws = getWeekStart(now);
    return { start: formatDate(ws), end: formatDate(addDays(ws, 6)) };
  }
  if (range === "this_month") {
    const ms = new Date(now.getFullYear(), now.getMonth(), 1);
    const me = getMonthEnd(now);
    return { start: formatDate(ms), end: formatDate(me) };
  }
  // next_week
  const ws = getWeekStart(now);
  const nextWs = addDays(ws, 7);
  return { start: formatDate(nextWs), end: formatDate(addDays(nextWs, 6)) };
}

function friendlyDateLabel(dateStr: string): string {
  const now = new Date();
  const today = formatDate(now);
  const tomorrow = formatDate(addDays(now, 1));
  const yesterday = formatDate(addDays(now, -1));

  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  if (dateStr === yesterday) return "Yesterday";

  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function isEventPast(event: EconomicEvent): boolean {
  const now = new Date();
  const eventDateTime = new Date(`${event.date}T${event.time || "00:00"}:00`);
  return eventDateTime < now;
}

function compareActualToForecast(
  actual: string | null,
  forecast: string | null
): "better" | "worse" | "neutral" {
  if (!actual || !forecast) return "neutral";
  const aMatch = actual.match(/^(-?[\d.]+)/);
  const fMatch = forecast.match(/^(-?[\d.]+)/);
  if (!aMatch || !fMatch) return "neutral";
  const a = parseFloat(aMatch[1]);
  const f = parseFloat(fMatch[1]);
  if (isNaN(a) || isNaN(f)) return "neutral";
  if (Math.abs(a - f) < 0.001) return "neutral";
  return a > f ? "better" : "worse";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ImpactDot({ impact }: { impact: ImpactLevel }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full shrink-0",
        impact === "high" && "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]",
        impact === "medium" && "bg-orange-500",
        impact === "low" && "bg-yellow-500"
      )}
      title={`${impact} impact`}
    />
  );
}

function FilterButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30"
          : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

function EventRow({ event }: { event: EconomicEvent }) {
  const [expanded, setExpanded] = useState(false);
  const past = isEventPast(event);
  const comparison = compareActualToForecast(event.actual, event.forecast);
  const flag = COUNTRY_FLAGS[event.country] || event.country;

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${event.title} ${event.country} economic data ${event.date}`
  )}`;
  const investingUrl = `https://www.investing.com/search/?q=${encodeURIComponent(event.title)}`;
  const yahooUrl = `https://finance.yahoo.com/calendar/economic/?q=${encodeURIComponent(event.title)}`;
  // Build Forex Factory calendar URL for the event's date (format: ?day=mar12.2026)
  const ffDate = (() => {
    const d = new Date(event.date + "T00:00:00");
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    return `${months[d.getMonth()]}${d.getDate()}.${d.getFullYear()}`;
  })();
  const forexFactoryUrl = `https://www.forexfactory.com/calendar?day=${ffDate}`;

  return (
    <div className="rounded-lg border transition-colors overflow-hidden"
      style={event.impact === "high" ? { borderColor: "rgba(239,68,68,0.1)", background: "rgba(239,68,68,0.04)" } : undefined}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
          event.impact === "high"
            ? "hover:bg-red-500/[0.07]"
            : "hover:bg-accent",
          past && "opacity-60"
        )}
      >
        {/* High-impact left accent */}
        {event.impact === "high" && (
          <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-red-500/60" />
        )}

        {/* Time */}
        <div className="flex w-14 shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{event.time || "--:--"}</span>
        </div>

        {/* Country flag */}
        <span className="w-7 shrink-0 text-center text-sm" title={event.country}>
          {flag}
        </span>

        {/* Impact */}
        <ImpactDot impact={event.impact} />

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-medium",
              event.impact === "high" ? "text-foreground" : "text-foreground/80"
            )}
          >
            {event.title}
          </p>
          <p className="text-[11px] text-muted-foreground/60">{event.currency}</p>
        </div>

        {/* Data columns */}
        <div className="hidden sm:flex items-center gap-6 shrink-0">
          {/* Forecast */}
          <div className="w-20 text-right">
            <p className="text-[11px] uppercase text-muted-foreground font-medium tracking-wide">Forecast</p>
            <p className="text-sm font-medium text-foreground/80">{event.forecast || "—"}</p>
          </div>

          {/* Previous */}
          <div className="w-20 text-right">
            <p className="text-[11px] uppercase text-muted-foreground font-medium tracking-wide">Previous</p>
            <p className="text-sm font-medium text-foreground/80">{event.previous || "—"}</p>
          </div>

          {/* Actual */}
          <div className="w-20 text-right">
            <p className="text-[11px] uppercase text-muted-foreground font-medium tracking-wide">Actual</p>
            <p
              className={cn(
                "text-sm font-bold",
                !event.actual && "text-muted-foreground/40",
                event.actual && comparison === "better" && "text-emerald-600 dark:text-emerald-400",
                event.actual && comparison === "worse" && "text-red-600 dark:text-red-400",
                event.actual && comparison === "neutral" && "text-foreground"
              )}
            >
              {event.actual || "—"}
            </p>
          </div>
        </div>

        {/* Expand indicator */}
        <div className="shrink-0 text-muted-foreground/40">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>

        {/* Mobile data summary */}
        <div className="flex sm:hidden items-center gap-2 shrink-0 text-xs">
          {event.actual ? (
            <span
              className={cn(
                "font-semibold",
                comparison === "better" && "text-emerald-600 dark:text-emerald-400",
                comparison === "worse" && "text-red-600 dark:text-red-400",
                comparison === "neutral" && "text-foreground/80"
              )}
            >
              {event.actual}
            </span>
          ) : event.forecast ? (
            <span className="text-muted-foreground">f: {event.forecast}</span>
          ) : null}
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
          {/* Mobile: show data values */}
          <div className="flex sm:hidden gap-4">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground/60">Forecast</p>
              <p className="text-sm">{event.forecast || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground/60">Previous</p>
              <p className="text-sm">{event.previous || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground/60">Actual</p>
              <p className={cn("text-sm font-semibold",
                event.actual && comparison === "better" && "text-emerald-600 dark:text-emerald-400",
                event.actual && comparison === "worse" && "text-red-600 dark:text-red-400",
              )}>{event.actual || "-"}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {getEventDescription(event.title, event.country)}
          </p>

          {/* Links */}
          <div className="flex flex-wrap gap-2">
            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#dadce0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-[#3c4043] dark:text-zinc-200 hover:shadow-sm transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              Google Search
            </a>
            <a
              href={investingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e07020]/30 bg-[#fff8f0] dark:bg-[#2a1f10] px-3 py-1.5 text-xs font-medium text-[#d4611e] dark:text-[#f0943a] hover:shadow-sm transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="#e07020"/>
                <text x="12" y="16.5" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white" fontFamily="Arial">i</text>
              </svg>
              Investing.com
            </a>
            <a
              href={forexFactoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#3b82c4]/30 bg-[#f0f6ff] dark:bg-[#0f1a2a] px-3 py-1.5 text-xs font-medium text-[#2a6db5] dark:text-[#5da3e8] hover:shadow-sm transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="1" y="1" width="22" height="22" rx="4" fill="#2a6db5"/>
                <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill="white" fontFamily="Arial">FF</text>
              </svg>
              Forex Factory
            </a>
            <a
              href={yahooUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#6001d2]/30 bg-[#f5f0ff] dark:bg-[#1a0f2a] px-3 py-1.5 text-xs font-medium text-[#6001d2] dark:text-[#a78bfa] hover:shadow-sm transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="1" y="1" width="22" height="22" rx="4" fill="#6001d2"/>
                <text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white" fontFamily="Arial">Y!</text>
              </svg>
              Yahoo Finance
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function getEventDescription(title: string, country: string): string {
  const t = title.toLowerCase();
  if (t.includes("cpi") || t.includes("inflation")) return `Consumer Price Index measures the change in prices paid by consumers for goods and services in ${country}. Higher than expected is typically bullish for the currency.`;
  if (t.includes("nfp") || t.includes("non-farm") || t.includes("payroll")) return `Non-Farm Payrolls measures the change in the number of employed people in the US (excluding farming). Strong jobs data is typically bullish for USD.`;
  if (t.includes("interest rate") || t.includes("rate decision")) return `Central bank interest rate decision for ${country}. Higher rates typically strengthen the currency, lower rates weaken it.`;
  if (t.includes("gdp")) return `Gross Domestic Product measures the total value of goods and services produced in ${country}. Higher GDP growth is bullish for the currency.`;
  if (t.includes("pmi")) return `Purchasing Managers Index surveys business conditions. Above 50 indicates expansion, below 50 indicates contraction.`;
  if (t.includes("unemployment")) return `Unemployment rate measures the percentage of the labor force that is unemployed in ${country}. Lower unemployment is typically bullish for the currency.`;
  if (t.includes("retail sales")) return `Retail Sales measures the change in total consumer spending at retail outlets in ${country}. Strong retail sales indicate healthy consumer spending.`;
  if (t.includes("trade balance")) return `Trade Balance measures the difference between exports and imports. A positive balance (surplus) is generally bullish for the currency.`;
  if (t.includes("jobless claims")) return `Initial Jobless Claims measures the number of new unemployment benefit applications. Lower claims indicate a stronger labor market.`;
  if (t.includes("fomc") || t.includes("fed")) return `Federal Open Market Committee announcements on US monetary policy. These events often cause significant market volatility.`;
  if (t.includes("ecb")) return `European Central Bank announcements on eurozone monetary policy. Key driver for EUR pairs.`;
  if (t.includes("boe")) return `Bank of England announcements on UK monetary policy. Key driver for GBP pairs.`;
  if (t.includes("boj")) return `Bank of Japan announcements on Japanese monetary policy. Key driver for JPY pairs.`;
  if (t.includes("cftc") || t.includes("speculative")) return `CFTC Commitments of Traders report showing speculative positioning in futures markets. Useful for gauging market sentiment.`;
  if (t.includes("jolts")) return `Job Openings and Labor Turnover Survey measures the number of job openings in ${country}. Higher openings suggest a strong labor market.`;
  if (t.includes("consumer confidence")) return `Consumer Confidence Index measures the level of consumer optimism about the economy in ${country}.`;
  return `Economic indicator for ${country}. Click the links below for more detailed information about this event.`;
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function EconomicCalendarPage() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("mock");

  // Filters
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [timeRange, setTimeRange] = useState<TimeRange>("this_week");
  const [customDate, setCustomDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    }
    if (showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDatePicker]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange(timeRange, customDate, customDate);
      const params = new URLSearchParams({
        start_date: start,
        end_date: end,
      });

      if (countryFilter !== "ALL") {
        params.set("country", countryFilter);
      }

      if (impactFilter !== "all") {
        params.set("impact", impactFilter);
      }

      const res = await fetch(`/api/calendar?${params}`);
      if (!res.ok) throw new Error("Failed to fetch calendar data");

      const data = await res.json();
      setEvents(data.events || []);
      setSource(data.source || "mock");
    } catch (err) {
      console.error("Calendar fetch error:", err);
      setError("Unable to load calendar events. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [timeRange, countryFilter, impactFilter, customDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Group events by date
  const groupedEvents: Record<string, EconomicEvent[]> = {};
  for (const event of events) {
    const key = event.date;
    if (!groupedEvents[key]) groupedEvents[key] = [];
    groupedEvents[key].push(event);
  }
  const sortedDates = Object.keys(groupedEvents).sort();

  // Stats
  const highCount = events.filter((e) => e.impact === "high").length;
  const totalCount = events.length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Economic Calendar
            </h1>
            <p className="text-sm text-muted-foreground">
              Track market-moving events and economic releases
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {totalCount} event{totalCount !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="text-xs text-muted-foreground/40">|</span>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          <span className="text-xs text-muted-foreground">
            {highCount} high impact
          </span>
        </div>
        {source === "mock" && (
          <>
            <span className="text-xs text-muted-foreground/40">|</span>
            <div className="flex items-center gap-1.5">
              <Info className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground/60">
                Sample data -- live data requires API key
              </span>
            </div>
          </>
        )}
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        {/* Time range */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Period:</span>
          {(
            [
              { key: "today", label: "Today" },
              { key: "tomorrow", label: "Tomorrow" },
              { key: "this_week", label: "This Week" },
              { key: "next_week", label: "Next Week" },
              { key: "this_month", label: "This Month" },
            ] as const
          ).map((t) => (
            <FilterButton
              key={t.key}
              active={timeRange === t.key}
              onClick={() => { setTimeRange(t.key); setShowDatePicker(false); }}
            >
              {t.label}
            </FilterButton>
          ))}

          {/* Date picker toggle */}
          <div className="relative" ref={datePickerRef}>
            <FilterButton
              active={timeRange === "custom"}
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                {timeRange === "custom" && customDate
                  ? new Date(customDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "Pick Date"}
              </span>
            </FilterButton>
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-1 z-50 rounded-lg border border-border bg-card shadow-lg p-3">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setTimeRange("custom");
                    setShowDatePicker(false);
                  }}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            )}
          </div>
        </div>

        {/* Impact + Country row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground mr-1">Impact:</span>
            {(
              [
                { key: "all", label: "All" },
                { key: "high", label: "High" },
                { key: "medium", label: "Medium" },
                { key: "low", label: "Low" },
              ] as const
            ).map((f) => (
              <FilterButton
                key={f.key}
                active={impactFilter === f.key}
                onClick={() => setImpactFilter(f.key)}
              >
                <span className="flex items-center gap-1.5">
                  {f.key !== "all" && <ImpactDot impact={f.key as ImpactLevel} />}
                  {f.label}
                </span>
              </FilterButton>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground mr-1">Country:</span>
            {COUNTRIES.map((c) => (
              <FilterButton
                key={c.code}
                active={countryFilter === c.code}
                onClick={() => setCountryFilter(c.code)}
              >
                <span className="flex items-center gap-1.5">
                  {c.code !== "ALL" && (
                    <span className="text-xs">
                      {COUNTRY_FLAGS[c.code] || c.code}
                    </span>
                  )}
                  {c.label}
                </span>
              </FilterButton>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Loading calendar events...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="h-8 w-8 text-red-500/60" />
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchEvents}
            className="mt-3 rounded-lg bg-secondary px-4 py-2 text-xs text-foreground/80 hover:bg-accent transition-colors"
          >
            Retry
          </button>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No events found for the selected filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const dayEvents = groupedEvents[dateStr];
            const label = friendlyDateLabel(dateStr);
            const isToday = dateStr === formatDate(new Date());

            return (
              <div key={dateStr}>
                {/* Date header */}
                <div className="mb-3 flex items-center gap-3">
                  <h2
                    className={cn(
                      "text-sm font-semibold",
                      isToday ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </h2>
                  <span className="text-[11px] text-muted-foreground/60">{dateStr}</span>
                  <div className="flex-1 border-t border-border" />
                  <span className="text-[11px] text-muted-foreground/60">
                    {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Events list */}
                <div className="space-y-1.5">
                  {dayEvents.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Legend</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> High Impact
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Medium
            Impact
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Low Impact
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Actual</span>{" "}
            Better than forecast
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-red-600 dark:text-red-400">Actual</span> Worse
            than forecast
          </span>
        </div>
      </div>
    </div>
  );
}
