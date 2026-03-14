"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Zap,
  LineChart,
  ArrowRight,
  X,
} from "lucide-react";

const ONBOARDING_KEY = "nq_sim_onboarded";

interface OnboardingStep {
  icon: typeof BarChart3;
  iconBg: string;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: BarChart3,
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
    title: "The AI Consensus",
    description:
      "This is what our AI analysts think about this market. If the score is red and Bearish, there's a high chance of a decline. If it's green and Bullish, expect a rise.",
  },
  {
    icon: Zap,
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    title: "The Simulator",
    description:
      "We've already pre-selected Buy or Sell based on the AI analysis. Fill in your Stop-Loss (safety net) and Take-Profit (profit target) to protect your trade. Tap the suggested values to auto-fill!",
  },
  {
    icon: LineChart,
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-500",
    title: "Your Trading Journal",
    description:
      "Once your trade is live, we monitor the market for you 24/7. Head to your Dashboard to track your virtual portfolio, see live P/L, and check your AI accuracy score.",
  },
];

export function SimulatorOnboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(ONBOARDING_KEY, "true");
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-6 bg-blue-500"
                    : i < step
                      ? "w-1.5 bg-blue-500/40"
                      : "w-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ${current.iconBg} shadow-lg`}
            >
              <Icon className="h-7 w-7 text-white" />
            </div>
          </div>

          {/* Content */}
          <h3 className="text-center text-lg font-bold mb-2">
            {current.title}
          </h3>
          <p className="text-center text-sm text-muted-foreground leading-relaxed mb-6">
            {current.description}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={dismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip tour
            </button>
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors"
            >
              {isLast ? "Get Started" : "Next"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
