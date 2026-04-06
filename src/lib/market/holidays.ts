/** Easter Sunday for a given year — Meeus/Jones/Butcher algorithm */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
}

export type MarketStatus = "open" | "weekend" | "holiday";

export interface MarketStatusInfo {
  status: MarketStatus;
  label: string; // e.g. "Easter Monday", "Christmas", "Weekend"
}

export function getMarketStatus(date: Date = new Date()): MarketStatusInfo {
  const dow = date.getDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return { status: "weekend", label: "Weekend" };

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-based
  const day = date.getDate();

  // Easter-based holidays
  const easter = easterSunday(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);
  if (sameDay(date, goodFriday))   return { status: "holiday", label: "Good Friday" };
  if (sameDay(date, easterMonday)) return { status: "holiday", label: "Easter Monday" };

  // Fixed global market holidays
  if (month === 1  && day === 1)  return { status: "holiday", label: "New Year's Day" };
  if (month === 12 && day === 24) return { status: "holiday", label: "Christmas Eve" };
  if (month === 12 && day === 25) return { status: "holiday", label: "Christmas" };
  if (month === 12 && day === 26) return { status: "holiday", label: "Boxing Day" };
  if (month === 12 && day === 31) return { status: "holiday", label: "New Year's Eve" };

  return { status: "open", label: "" };
}
