"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MarketSession {
  name: string;
  city: string;
  openHourUTC: number;
  closeHourUTC: number;
  emoji: string;
  color: string;
  colorBg: string;
}

const SESSIONS: MarketSession[] = [
  {
    name: "Sydney",
    city: "Sydney",
    openHourUTC: 21, // 21:00 UTC (previous day) = 08:00 AEDT
    closeHourUTC: 6,  // 06:00 UTC = 17:00 AEDT
    emoji: "\u{1F1E6}\u{1F1FA}",
    color: "text-cyan-500",
    colorBg: "bg-cyan-500",
  },
  {
    name: "Tokyo",
    city: "Tokyo",
    openHourUTC: 0,   // 00:00 UTC = 09:00 JST
    closeHourUTC: 9,   // 09:00 UTC = 18:00 JST
    emoji: "\u{1F1EF}\u{1F1F5}",
    color: "text-red-500",
    colorBg: "bg-red-500",
  },
  {
    name: "London",
    city: "London",
    openHourUTC: 7,   // 07:00 UTC = 08:00 GMT/BST
    closeHourUTC: 16,  // 16:00 UTC = 17:00 GMT/BST
    emoji: "\u{1F1EC}\u{1F1E7}",
    color: "text-blue-500",
    colorBg: "bg-blue-500",
  },
  {
    name: "New York",
    city: "New York",
    openHourUTC: 13,  // 13:00 UTC = 08:00 EST
    closeHourUTC: 22,  // 22:00 UTC = 17:00 EST
    emoji: "\u{1F1FA}\u{1F1F8}",
    color: "text-emerald-500",
    colorBg: "bg-emerald-500",
  },
];

function isSessionOpen(session: MarketSession, nowUTC: Date): boolean {
  const hour = nowUTC.getUTCHours();
  const day = nowUTC.getUTCDay(); // 0=Sun, 6=Sat

  // Saturday: always closed
  if (day === 6) return false;

  // Sunday: forex opens at 21:00 UTC (Sydney session)
  // Before 21:00 UTC Sunday = closed for all
  // After 21:00 UTC Sunday = Sydney is open, others still closed
  if (day === 0) {
    if (hour < 21) return false;
    // Sunday 21:00+ UTC: only sessions that cross midnight are open
    if (session.openHourUTC > session.closeHourUTC) {
      return hour >= session.openHourUTC; // e.g. Sydney opens at 21
    }
    return false; // Tokyo (0-9), London (7-16), NY (13-22) not yet open
  }

  // Friday: closed after 21:00 UTC (market close)
  if (day === 5 && hour >= 21) return false;

  // Monday: sessions that cross midnight opened Sunday evening
  // e.g., Sydney opened Sun 21:00 UTC, still open Mon 00:00-06:00
  if (session.openHourUTC > session.closeHourUTC) {
    return hour >= session.openHourUTC || hour < session.closeHourUTC;
  }
  return hour >= session.openHourUTC && hour < session.closeHourUTC;
}

function getTimeUntil(session: MarketSession, nowUTC: Date, isOpen: boolean): string {
  const targetHour = isOpen ? session.closeHourUTC : session.openHourUTC;

  // Build target date at targetHour:00:00 UTC today
  const target = new Date(nowUTC);
  target.setUTCHours(targetHour, 0, 0, 0);

  // If target is in the past, move to next day
  if (target.getTime() <= nowUTC.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  // Skip weekends — markets don't open on Saturday or Sunday
  // Forex market closes Friday ~22:00 UTC and reopens Sunday ~21:00 UTC (Sydney)
  if (!isOpen) {
    let targetDay = target.getUTCDay();
    // If target lands on Saturday, push to Monday (unless Sydney which opens Sunday 21:00 UTC)
    if (targetDay === 6) {
      // Saturday → skip to Sunday first
      if (session.openHourUTC === 21) {
        // Sydney opens Sunday evening UTC — just push 1 day
        target.setUTCDate(target.getUTCDate() + 1);
      } else {
        // All other sessions open Monday
        target.setUTCDate(target.getUTCDate() + 2);
      }
    } else if (targetDay === 0) {
      // Sunday
      if (session.openHourUTC === 21) {
        // Sydney opens Sunday evening — keep it (if target hour hasn't passed)
        // Already correct
      } else {
        // All other sessions open Monday
        target.setUTCDate(target.getUTCDate() + 1);
      }
    }
  }

  const diffMs = target.getTime() - nowUTC.getTime();
  if (diffMs <= 0) return "";

  const totalSecs = Math.floor(diffMs / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (d > 0) return `${d}d ${h}h ${pad(m)}m ${pad(s)}s`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

function formatSessionTime(hourUTC: number): string {
  const h = hourUTC % 24;
  return `${h.toString().padStart(2, "0")}:00 UTC`;
}

function SessionCard({ session }: { session: MarketSession }) {
  const timerRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(() => isSessionOpen(session, new Date()));

  useEffect(() => {
    let rafId: number;
    let lastSecond = -1;

    function update() {
      const now = new Date();
      const currentSecond = now.getSeconds();

      // Only update DOM when the second actually changes
      if (currentSecond !== lastSecond) {
        lastSecond = currentSecond;

        const open = isSessionOpen(session, now);
        setIsOpen(open);

        if (timerRef.current) {
          const timeInfo = getTimeUntil(session, now, open);
          const prefix = open ? "Closes in " : "Opens in ";
          timerRef.current.textContent = timeInfo ? prefix + timeInfo : "";
        }
      }

      rafId = requestAnimationFrame(update);
    }

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [session]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all",
        isOpen && "border-opacity-80"
      )}
    >
      {/* Subtle top accent bar */}
      <div className={cn("absolute inset-x-0 top-0 h-0.5", session.colorBg, isOpen ? "opacity-100" : "opacity-30")} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{session.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-foreground">{session.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatSessionTime(session.openHourUTC)} — {formatSessionTime(session.closeHourUTC)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "h-2 w-2 rounded-full",
            isOpen ? session.colorBg : "bg-red-500/40",
            isOpen && "animate-pulse"
          )} />
          <span className={cn(
            "text-xs font-bold",
            isOpen ? "text-emerald-500" : "text-red-500"
          )}>
            {isOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      <p className={cn(
        "mt-2 text-sm font-semibold tabular-nums",
        isOpen ? "text-emerald-500" : "text-red-500"
      )}>
        <span ref={timerRef} />
      </p>
    </div>
  );
}

export function SessionTimes() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {SESSIONS.map((session) => (
        <SessionCard key={session.name} session={session} />
      ))}
    </div>
  );
}
