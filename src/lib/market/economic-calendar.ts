const BASE_URL = "https://eodhd.com/api";
const API_KEY = process.env.EODHD_API_KEY;

export type ImpactLevel = "high" | "medium" | "low";

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  impact: ImpactLevel;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  currency: string;
}

interface EodhdCalendarEvent {
  type: string;
  comparison: string;
  country: string;
  date: string;
  actual: string | number | null;
  previous: string | number | null;
  estimate: string | number | null;
  change: number | null;
  impact: string;
  currency: string;
}

// ---------------------------------------------------------------------------
// Impact classification — EODHD often returns null/empty for impact
// We classify known events by keyword matching
// ---------------------------------------------------------------------------

const HIGH_IMPACT_KEYWORDS = [
  "interest rate",
  "rate decision",
  "non-farm",
  "nonfarm",
  "payroll",
  "cpi",
  "consumer price",
  "core cpi",
  "unemployment rate",
  "gdp",
  "fomc",
  "fed press conference",
  "fed chair",
  "fed powell",
  "ecb press conference",
  "ecb president",
  "boe governor",
  "boj governor",
  "retail sales",
  "pce price",
  "core pce",
  "employment change",
  "tankan",
];

const MEDIUM_IMPACT_KEYWORDS = [
  "pmi",
  "ism ",
  "ppi",
  "jobless claims",
  "initial claims",
  "continuing claims",
  "trade balance",
  "balance of trade",
  "jolts",
  "adp ",
  "average hourly",
  "housing starts",
  "building permits",
  "durable goods",
  "industrial production",
  "consumer confidence",
  "michigan",
  "philly fed",
  "philadelphia fed",
  "empire state",
  "existing home",
  "new home",
  "pending home",
  "import prices",
  "export prices",
  "leading indicators",
  "manufacturing index",
  "services index",
  "capacity utilization",
  "factory orders",
  "wholesale inventories",
  "business inventories",
  "construction spending",
  "personal income",
  "personal spending",
  "current account",
];

function classifyImpact(eventType: string, apiImpact: string | null): ImpactLevel {
  // If EODHD provides a valid impact, use it
  if (apiImpact) {
    const normalized = apiImpact.toLowerCase();
    if (normalized === "high" || normalized === "3") return "high";
    if (normalized === "medium" || normalized === "2") return "medium";
    if (normalized === "low" || normalized === "1") return "low";
  }

  // Classify by keyword
  const title = eventType.toLowerCase();

  for (const keyword of HIGH_IMPACT_KEYWORDS) {
    if (title.includes(keyword)) return "high";
  }

  for (const keyword of MEDIUM_IMPACT_KEYWORDS) {
    if (title.includes(keyword)) return "medium";
  }

  return "low";
}

// ---------------------------------------------------------------------------
// Currency mapping per country
// ---------------------------------------------------------------------------

const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  EU: "EUR",
  UK: "GBP",
  GB: "GBP",
  JP: "JPY",
  CH: "CHF",
  AU: "AUD",
  CA: "CAD",
  NZ: "NZD",
  CN: "CNY",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  AT: "EUR",
  BE: "EUR",
  FI: "EUR",
  PT: "EUR",
  IE: "EUR",
  GR: "EUR",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  HU: "HUF",
  CZ: "CZK",
  RO: "RON",
  BR: "BRL",
  MX: "MXN",
  AR: "ARS",
  ZA: "ZAR",
  IN: "INR",
  KR: "KRW",
  SG: "SGD",
  HK: "HKD",
  TW: "TWD",
  TH: "THB",
  ID: "IDR",
  MY: "MYR",
  PH: "PHP",
  TR: "TRY",
  RU: "RUB",
  IL: "ILS",
  SA: "SAR",
  AE: "AED",
  CO: "COP",
  CL: "CLP",
  PE: "PEN",
};

// ---------------------------------------------------------------------------
// Parse & deduplicate
// ---------------------------------------------------------------------------

function parseEventFromApi(event: EodhdCalendarEvent, index: number): EconomicEvent {
  // EODHD returns dates as "2026-03-13 14:00:00" (space separator) or "2026-03-13T14:00:00"
  const separator = event.date?.includes("T") ? "T" : " ";
  const dateStr = event.date ? event.date.split(separator)[0] : "";
  const timeStr = event.date && event.date.includes(separator)
    ? event.date.split(separator)[1]?.substring(0, 5) || ""
    : "";

  const country = (event.country || "").toUpperCase();
  const rawTitle = event.type || "";
  // Filter out junk values from EODHD — never show "Unknown" to the user
  const junkTitles = ["unknown", "null", "undefined", "unknown event", ""];
  const title = junkTitles.includes(rawTitle.toLowerCase().trim()) ? "Economic Release" : rawTitle;

  // Build display title with comparison suffix if available
  let displayTitle = title;
  if (event.comparison) {
    const comp = event.comparison.toLowerCase();
    if (comp === "mom") displayTitle += " (MoM)";
    else if (comp === "qoq") displayTitle += " (QoQ)";
    else if (comp === "yoy") displayTitle += " (YoY)";
  }

  return {
    id: `eod-${dateStr}-${index}`,
    title: displayTitle,
    country,
    date: dateStr,
    time: timeStr,
    impact: classifyImpact(displayTitle, event.impact),
    actual: event.actual != null ? String(event.actual) : null,
    forecast: event.estimate != null ? String(event.estimate) : null,
    previous: event.previous != null ? String(event.previous) : null,
    currency: event.currency || COUNTRY_CURRENCY[country] || "",
  };
}

function deduplicateEvents(events: EconomicEvent[]): EconomicEvent[] {
  const seen = new Map<string, EconomicEvent>();

  for (const event of events) {
    // Create a dedup key based on title + country + date + time
    const key = `${event.title}|${event.country}|${event.date}|${event.time}`;

    if (!seen.has(key)) {
      seen.set(key, event);
    } else {
      // Keep the one with more data (actual, forecast, etc.)
      const existing = seen.get(key)!;
      const existingScore = (existing.actual ? 1 : 0) + (existing.forecast ? 1 : 0) + (existing.previous ? 1 : 0);
      const newScore = (event.actual ? 1 : 0) + (event.forecast ? 1 : 0) + (event.previous ? 1 : 0);
      if (newScore > existingScore) {
        seen.set(key, event);
      }
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------

export async function getEconomicCalendar(options?: {
  country?: string;
  startDate?: string;
  endDate?: string;
}): Promise<EconomicEvent[]> {
  // Try EODHD API first
  if (API_KEY) {
    try {
      const params: Record<string, string> = {
        api_token: API_KEY,
        fmt: "json",
        limit: "500",
      };
      if (options?.country) params.country = options.country;
      if (options?.startDate) params.from = options.startDate;
      if (options?.endDate) params.to = options.endDate;

      const searchParams = new URLSearchParams(params);
      const url = `${BASE_URL}/economic-events?${searchParams}`;

      const response = await fetch(url, { next: { revalidate: 300 } }); // Cache 5 minutes

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          let events = data.map((event: EodhdCalendarEvent, i: number) =>
            parseEventFromApi(event, i)
          );

          // Deduplicate
          events = deduplicateEvents(events);

          // Sort by date then time
          events.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
          });

          return events;
        }
      }
    } catch (error) {
      console.error("EODHD economic calendar error:", error);
    }
  }

  // Fallback to mock data
  return generateMockEvents(options?.country, options?.startDate, options?.endDate);
}

// ---------------------------------------------------------------------------
// Mock data generator -- produces realistic events for the requested range
// ---------------------------------------------------------------------------

interface MockEventTemplate {
  title: string;
  country: string;
  currency: string;
  impact: ImpactLevel;
  forecast: string;
  previous: string;
  actual: string | null;
  timeHour: number;
  timeMinute: number;
  dayOffset: number; // 0 = Monday of the week
}

function getWeekStartDate(referenceDate: Date): Date {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function generateMockEvents(
  countryFilter?: string,
  startDate?: string,
  endDate?: string
): EconomicEvent[] {
  const now = new Date();
  const weekStart = getWeekStartDate(now);

  // Build two weeks of events so we always have data for "this week" and "next week"
  const templates: MockEventTemplate[] = [
    // --- Week 1 (this week) ---
    { title: "Manufacturing PMI", country: "US", currency: "USD", impact: "medium", forecast: "52.3", previous: "51.8", actual: null, timeHour: 14, timeMinute: 0, dayOffset: 0 },
    { title: "ISM Services PMI", country: "US", currency: "USD", impact: "high", forecast: "53.5", previous: "53.0", actual: null, timeHour: 15, timeMinute: 0, dayOffset: 0 },
    { title: "RBA Interest Rate Decision", country: "AU", currency: "AUD", impact: "high", forecast: "4.10%", previous: "4.10%", actual: null, timeHour: 3, timeMinute: 30, dayOffset: 1 },
    { title: "JOLTS Job Openings", country: "US", currency: "USD", impact: "medium", forecast: "7.65M", previous: "7.74M", actual: null, timeHour: 15, timeMinute: 0, dayOffset: 1 },
    { title: "ECB President Lagarde Speaks", country: "EU", currency: "EUR", impact: "high", forecast: "", previous: "", actual: null, timeHour: 14, timeMinute: 30, dayOffset: 1 },
    { title: "ADP Non-Farm Employment Change", country: "US", currency: "USD", impact: "high", forecast: "148K", previous: "155K", actual: null, timeHour: 13, timeMinute: 15, dayOffset: 2 },
    { title: "UK GDP (MoM)", country: "UK", currency: "GBP", impact: "high", forecast: "0.2%", previous: "0.1%", actual: null, timeHour: 7, timeMinute: 0, dayOffset: 2 },
    { title: "Trade Balance", country: "US", currency: "USD", impact: "medium", forecast: "-68.5B", previous: "-65.7B", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 2 },
    { title: "Switzerland CPI (YoY)", country: "CH", currency: "CHF", impact: "high", forecast: "0.6%", previous: "0.3%", actual: null, timeHour: 7, timeMinute: 30, dayOffset: 2 },
    { title: "Initial Jobless Claims", country: "US", currency: "USD", impact: "medium", forecast: "218K", previous: "221K", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 3 },
    { title: "ECB Interest Rate Decision", country: "EU", currency: "EUR", impact: "high", forecast: "2.65%", previous: "2.65%", actual: null, timeHour: 12, timeMinute: 45, dayOffset: 3 },
    { title: "Japan Tankan Large Manufacturers Index", country: "JP", currency: "JPY", impact: "high", forecast: "14", previous: "14", actual: null, timeHour: 0, timeMinute: 50, dayOffset: 3 },
    { title: "Non-Farm Payrolls", country: "US", currency: "USD", impact: "high", forecast: "175K", previous: "151K", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 4 },
    { title: "Unemployment Rate", country: "US", currency: "USD", impact: "high", forecast: "4.0%", previous: "4.1%", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 4 },
    { title: "Average Hourly Earnings (MoM)", country: "US", currency: "USD", impact: "medium", forecast: "0.3%", previous: "0.3%", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 4 },
    { title: "Australia Employment Change", country: "AU", currency: "AUD", impact: "high", forecast: "30.0K", previous: "-7.8K", actual: null, timeHour: 0, timeMinute: 30, dayOffset: 4 },

    // --- Week 2 (next week) ---
    { title: "CPI (YoY)", country: "US", currency: "USD", impact: "high", forecast: "2.9%", previous: "2.8%", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 7 },
    { title: "CPI (MoM)", country: "US", currency: "USD", impact: "high", forecast: "0.3%", previous: "0.2%", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 7 },
    { title: "Core CPI (MoM)", country: "US", currency: "USD", impact: "high", forecast: "0.3%", previous: "0.2%", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 7 },
    { title: "UK CPI (YoY)", country: "UK", currency: "GBP", impact: "high", forecast: "3.0%", previous: "3.0%", actual: null, timeHour: 7, timeMinute: 0, dayOffset: 8 },
    { title: "PPI (MoM)", country: "US", currency: "USD", impact: "medium", forecast: "0.3%", previous: "0.4%", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 8 },
    { title: "Federal Reserve Interest Rate Decision", country: "US", currency: "USD", impact: "high", forecast: "4.50%", previous: "4.50%", actual: null, timeHour: 19, timeMinute: 0, dayOffset: 9 },
    { title: "FOMC Economic Projections", country: "US", currency: "USD", impact: "high", forecast: "", previous: "", actual: null, timeHour: 19, timeMinute: 0, dayOffset: 9 },
    { title: "FOMC Press Conference", country: "US", currency: "USD", impact: "high", forecast: "", previous: "", actual: null, timeHour: 19, timeMinute: 30, dayOffset: 9 },
    { title: "BOE Interest Rate Decision", country: "UK", currency: "GBP", impact: "high", forecast: "4.50%", previous: "4.50%", actual: null, timeHour: 12, timeMinute: 0, dayOffset: 10 },
    { title: "BOJ Interest Rate Decision", country: "JP", currency: "JPY", impact: "high", forecast: "0.50%", previous: "0.50%", actual: null, timeHour: 3, timeMinute: 0, dayOffset: 10 },
    { title: "US Retail Sales (MoM)", country: "US", currency: "USD", impact: "high", forecast: "0.6%", previous: "0.2%", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 10 },
    { title: "Philadelphia Fed Manufacturing Index", country: "US", currency: "USD", impact: "medium", forecast: "8.5", previous: "18.1", actual: null, timeHour: 13, timeMinute: 30, dayOffset: 10 },
    { title: "Existing Home Sales", country: "US", currency: "USD", impact: "medium", forecast: "4.15M", previous: "4.08M", actual: null, timeHour: 15, timeMinute: 0, dayOffset: 11 },
    { title: "SNB Interest Rate Decision", country: "CH", currency: "CHF", impact: "high", forecast: "0.25%", previous: "0.50%", actual: null, timeHour: 8, timeMinute: 30, dayOffset: 10 },
  ];

  // Mark events in the past as having an "actual" value
  const today = formatDate(now);

  const events: EconomicEvent[] = templates.map((t, index) => {
    const eventDate = addDays(weekStart, t.dayOffset);
    const dateStr = formatDate(eventDate);
    const timeStr = `${String(t.timeHour).padStart(2, "0")}:${String(t.timeMinute).padStart(2, "0")}`;

    // Determine if event is in the past -- give it an actual value
    let actual = t.actual;
    if (dateStr < today) {
      // Slightly vary from forecast for realism
      actual = generateActualValue(t.forecast, t.previous);
    }

    return {
      id: `mock-${dateStr}-${index}`,
      title: t.title,
      country: t.country,
      date: dateStr,
      time: timeStr,
      impact: t.impact,
      actual,
      forecast: t.forecast || null,
      previous: t.previous || null,
      currency: t.currency,
    };
  });

  // Apply filters
  let filtered = events;

  if (countryFilter && countryFilter.toUpperCase() !== "ALL") {
    const c = countryFilter.toUpperCase();
    filtered = filtered.filter((e) => e.country === c);
  }

  if (startDate) {
    filtered = filtered.filter((e) => e.date >= startDate);
  }

  if (endDate) {
    filtered = filtered.filter((e) => e.date <= endDate);
  }

  // Sort by date then time
  filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  return filtered;
}

function generateActualValue(forecast: string, previous: string): string | null {
  const ref = forecast || previous;
  if (!ref) return null;

  // Parse numeric portion
  const match = ref.match(/^(-?[\d.]+)/);
  if (!match) return ref;

  const num = parseFloat(match[1]);
  // Random variation of +/- 10%
  const variation = (Math.random() - 0.5) * 0.2 * Math.abs(num || 1);
  const result = num + variation;

  // Preserve formatting (%, K, M, B)
  const suffix = ref.replace(/^-?[\d.]+/, "");

  if (ref.includes(".")) {
    const decimals = (ref.split(".")[1] || "").replace(/[^0-9]/g, "").length;
    return result.toFixed(decimals) + suffix;
  }

  return Math.round(result).toString() + suffix;
}
