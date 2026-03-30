export interface WeekendRiskResult {
  isRisky: boolean;
  isClosed: boolean; // true on Saturday/Sunday — markets fully closed
  reason: string;
  riskLevel: "high" | "medium" | "none";
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
 * Returns weekend risk status based on the user's local time.
 * Friday 15:00+ local = high risk (markets closing soon).
 * Saturday/Sunday = markets closed.
 */
export function getWeekendRisk(): WeekendRiskResult {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, …, 5=Fri, 6=Sat
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const time = hour + minutes / 60;

  if (day === 6) {
    return {
      isRisky: true,
      isClosed: true,
      reason: "Markets are closed on Saturday. Trades can't execute.",
      riskLevel: "high",
    };
  }

  if (day === 0) {
    return {
      isRisky: true,
      isClosed: true,
      reason: "Markets are closed on Sunday. Trades can't execute.",
      riskLevel: "high",
    };
  }

  // Friday afternoon (15:00+): NY close approaching, weekend gap risk
  if (day === 5 && time >= 15) {
    return {
      isRisky: true,
      isClosed: false,
      reason: "Friday afternoon — markets close in a few hours. Weekend gaps can skip SL/TP.",
      riskLevel: "high",
    };
  }

  // Friday morning (09:00–15:00): elevated but tradeable
  if (day === 5 && time >= 9) {
    return {
      isRisky: true,
      isClosed: false,
      reason: "Friday — weekend gap risk. Consider reduced position size.",
      riskLevel: "medium",
    };
  }

  return { isRisky: false, isClosed: false, reason: "", riskLevel: "none" };
}
