/**
 * Weekend Risk Manager — UTC-based market session detection.
 *
 * Forex market hours (UTC):
 *   Open:  Sunday 22:00 UTC
 *   Close: Friday 22:00 UTC
 */

export interface WeekendRiskResult {
  isRisky: boolean;
  isClosed: boolean;       // true when market is fully closed
  reason: string;          // human-readable, shown in UI
  riskLevel: "high" | "medium" | "none";
  marketStatus: "open" | "closing_soon" | "closed" | "reopening_soon";
}

export interface MarketSessionStatus {
  isOpen: boolean;
  nextEventLabel: string;  // e.g. "Closes in 2h 15m (Friday 22:00 UTC)"
  hoursUntilClose: number | null;
  hoursUntilOpen: number | null;
}

export interface WeekendRiskSettings {
  warnOnFriday: boolean;
  reducePositionSize: boolean;
  reduceMultiplier: number; // 0.1–1.0
}

export const DEFAULT_WEEKEND_RISK_SETTINGS: WeekendRiskSettings = {
  warnOnFriday: true,
  reducePositionSize: true,
  reduceMultiplier: 0.5,
};

export function getWeekendRiskSettings(): WeekendRiskSettings {
  if (typeof window === "undefined") return DEFAULT_WEEKEND_RISK_SETTINGS;
  try {
    const raw = localStorage.getItem("weekendRiskSettings");
    return raw ? { ...DEFAULT_WEEKEND_RISK_SETTINGS, ...JSON.parse(raw) } : DEFAULT_WEEKEND_RISK_SETTINGS;
  } catch {
    return DEFAULT_WEEKEND_RISK_SETTINGS;
  }
}

export function saveWeekendRiskSettings(settings: WeekendRiskSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("weekendRiskSettings", JSON.stringify(settings));
}

/**
 * Detect weekend/closing risk based on UTC market hours.
 * Forex: closes Friday 22:00 UTC, reopens Sunday 22:00 UTC.
 */
export function getWeekendRisk(): WeekendRiskResult {
  const now = new Date();
  const dayUTC = now.getUTCDay();    // 0=Sun, 1=Mon, …, 5=Fri, 6=Sat
  const hourUTC = now.getUTCHours();
  const minUTC = now.getUTCMinutes();
  const timeUTC = hourUTC + minUTC / 60;

  // ── Saturday (all day) ──────────────────────────────────────────────────
  if (dayUTC === 6) {
    return {
      isRisky: true,
      isClosed: true,
      reason: "Markets closed — Saturday. Reopens Sunday 22:00 UTC.",
      riskLevel: "high",
      marketStatus: "closed",
    };
  }

  // ── Sunday before 22:00 UTC ─────────────────────────────────────────────
  if (dayUTC === 0 && timeUTC < 22) {
    const hoursLeft = 22 - timeUTC;
    const h = Math.floor(hoursLeft);
    const m = Math.round((hoursLeft - h) * 60);
    return {
      isRisky: true,
      isClosed: true,
      reason: `Markets reopening in ${h}h ${m}m (Sunday 22:00 UTC).`,
      riskLevel: "high",
      marketStatus: "reopening_soon",
    };
  }

  // ── Friday after 22:00 UTC ──────────────────────────────────────────────
  if (dayUTC === 5 && timeUTC >= 22) {
    return {
      isRisky: true,
      isClosed: true,
      reason: "Markets closed — Friday after 22:00 UTC. Reopens Sunday 22:00 UTC.",
      riskLevel: "high",
      marketStatus: "closed",
    };
  }

  // ── Friday 20:00–22:00 UTC (closing in < 2 hours) ───────────────────────
  if (dayUTC === 5 && timeUTC >= 20) {
    const hoursLeft = 22 - timeUTC;
    const h = Math.floor(hoursLeft);
    const m = Math.round((hoursLeft - h) * 60);
    return {
      isRisky: true,
      isClosed: false,
      reason: `Markets close in ${h}h ${m}m (Friday 22:00 UTC). Weekend gap risk — consider closing positions.`,
      riskLevel: "high",
      marketStatus: "closing_soon",
    };
  }

  // ── Friday all day (before 20:00 UTC) ───────────────────────────────────
  if (dayUTC === 5) {
    return {
      isRisky: true,
      isClosed: false,
      reason: "Friday — markets close at 22:00 UTC. Reduced position size recommended.",
      riskLevel: "medium",
      marketStatus: "closing_soon",
    };
  }

  // ── Normal trading hours ────────────────────────────────────────────────
  return {
    isRisky: false,
    isClosed: false,
    reason: "",
    riskLevel: "none",
    marketStatus: "open",
  };
}

/**
 * Returns session status with countdown labels for the UI indicator.
 */
export function getMarketSessionStatus(): MarketSessionStatus {
  const now = new Date();
  const dayUTC = now.getUTCDay();
  const hourUTC = now.getUTCHours();
  const minUTC = now.getUTCMinutes();
  const timeUTC = hourUTC + minUTC / 60;

  function fmt(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // Closed: Saturday, Sunday before 22:00, Friday after 22:00
  const isClosed =
    dayUTC === 6 ||
    (dayUTC === 0 && timeUTC < 22) ||
    (dayUTC === 5 && timeUTC >= 22);

  if (!isClosed) {
    // Market is open — calculate hours until Friday 22:00 UTC
    let daysToFriday = (5 - dayUTC + 7) % 7;
    if (dayUTC === 5) daysToFriday = 0;
    const hoursUntilClose = daysToFriday * 24 + (22 - timeUTC);
    const label =
      hoursUntilClose < 4
        ? `Closes in ${fmt(hoursUntilClose)} (Fri 22:00 UTC)`
        : dayUTC === 5
          ? `Closes today at 22:00 UTC`
          : `Open · closes Fri 22:00 UTC`;
    return {
      isOpen: true,
      nextEventLabel: label,
      hoursUntilClose,
      hoursUntilOpen: null,
    };
  }

  // Market is closed — calculate hours until Sunday 22:00 UTC
  let hoursUntilOpen: number;
  if (dayUTC === 6) {
    hoursUntilOpen = (24 - timeUTC) + 22; // rest of Saturday + Sunday until 22:00
  } else if (dayUTC === 0 && timeUTC < 22) {
    hoursUntilOpen = 22 - timeUTC;
  } else {
    // Friday after 22:00
    hoursUntilOpen = (24 - timeUTC) + 48; // rest of Friday + Saturday + Sunday until 22:00
  }

  return {
    isOpen: false,
    nextEventLabel: `Reopens in ${fmt(hoursUntilOpen)} (Sun 22:00 UTC)`,
    hoursUntilClose: null,
    hoursUntilOpen,
  };
}
