"use client";

import { useEffect, useRef } from "react";
import { HelpCircle } from "lucide-react";
import "driver.js/dist/driver.css";

const STORAGE_KEY = "nq_tour_completed";

const steps = [
  {
    element: "[data-tour='run-analysis']",
    popover: {
      title: "Step 1 — Run AI Analysis",
      description:
        "Click this button to let 3 AI analysts examine the market. They each check technical indicators, patterns, and market conditions.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='consensus']",
    popover: {
      title: "Step 2 — AI Consensus",
      description:
        "After analysis, you'll see the verdict here: Bullish (price expected to rise), Bearish (expected to fall), or Neutral. The score shows how confident the AI is.",
      side: "left" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='simulator']",
    popover: {
      title: "Step 3 — Quick Simulator",
      description:
        "This is where you practice trading with virtual money ($10,000). No real money — just learning. The AI pre-fills everything for you.",
      side: "top" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='sl-tp']",
    popover: {
      title: "Step 4 — Stop Loss & Take Profit",
      description:
        "Stop Loss = your safety net (limits your loss if the trade goes wrong). Take Profit = your target (locks in gains when price reaches it). Pro users can auto-fill these with AI.",
      side: "top" as const,
      align: "start" as const,
    },
  },
  {
    element: "[data-tour='open-trade']",
    popover: {
      title: "Step 5 — Open Trade",
      description:
        "When you're happy with the setup, click here to open a virtual trade. Track your results on the Simulator page. Good luck! 🚀",
      side: "top" as const,
      align: "start" as const,
    },
  },
];

export function TourButton() {
  const driverRef = useRef<ReturnType<typeof import("driver.js")["driver"]> | null>(null);

  const startTour = async () => {
    const { driver } = await import("driver.js");
    driverRef.current = driver({
      showProgress: true,
      animate: true,
      overlayColor: "black",
      overlayOpacity: 0.6,
      stagePadding: 8,
      stageRadius: 8,
      allowClose: true,
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Start Trading 🚀",
      onDestroyStarted: () => {
        driverRef.current?.destroy();
        localStorage.setItem(STORAGE_KEY, "true");
      },
      steps: steps.filter((s) => document.querySelector(s.element) !== null),
    });
    driverRef.current.drive();
  };

  // Auto-start tour on first visit
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Small delay so page elements are rendered
      const timer = setTimeout(startTour, 1200);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      onClick={startTour}
      title="Start guided tour"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50 transition-colors"
    >
      <HelpCircle className="h-3.5 w-3.5" />
      Tour
    </button>
  );
}
