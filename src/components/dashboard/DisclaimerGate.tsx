"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, ExternalLink } from "lucide-react";

const DISCLAIMER_KEY = "disclaimer_accepted";
const EXPIRY_DAYS = 30;

function isDisclaimerValid(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(DISCLAIMER_KEY);
  if (!stored) return false;

  try {
    const timestamp = Number(stored);
    if (isNaN(timestamp)) return false;
    const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp < expiryMs;
  } catch {
    return false;
  }
}

const riskWarnings = [
  {
    text: "AI-generated analysis is for educational and informational purposes ONLY. It should not be relied upon as the sole basis for any financial decision.",
  },
  {
    text: "This is NOT investment advice, financial advice, trading advice, or a recommendation to buy, sell, or hold any security or financial instrument.",
  },
  {
    text: "AI models have inherent limitations and may produce inaccurate, incomplete, or misleading results. Outputs should always be independently verified.",
  },
  {
    text: "Trading and investing in financial markets involves significant risk of loss, including the potential for total loss of your invested capital.",
  },
  {
    text: "Past performance, whether real or simulated, does not guarantee or indicate future results. Market conditions can change rapidly and unpredictably.",
  },
  {
    text: "You should consult a qualified, licensed financial advisor before making any investment decisions. Do not act on AI-generated analysis alone.",
  },
];

export function DisclaimerGate({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setAccepted(isDisclaimerValid());
  }, []);

  const handleAccept = () => {
    localStorage.setItem(DISCLAIMER_KEY, String(Date.now()));
    setAccepted(true);
  };

  // During SSR or initial hydration, render children but hidden behind the gate
  // This prevents a flash of content
  if (accepted === null) {
    return <>{children}</>;
  }

  if (accepted) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-4 flex w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 border-b border-white/5 px-6 pt-8 pb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
              <ShieldAlert className="h-7 w-7 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Risk Disclosure & Terms of Use
            </h1>
            <p className="text-center text-sm text-zinc-400">
              Please read the following risk warnings carefully before
              proceeding.
            </p>
          </div>

          {/* Scrollable warnings */}
          <div className="max-h-[40vh] overflow-y-auto px-6 py-5">
            <div className="space-y-3">
              {riskWarnings.map((warning, index) => (
                <div
                  key={index}
                  className="flex gap-3 rounded-lg border border-red-500/10 bg-red-500/[0.03] p-3.5"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {warning.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Legal links */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/5 pt-4">
              <p className="w-full text-center text-xs text-zinc-500">
                By continuing, you agree to our:
              </p>
              <Link
                href="/legal/terms"
                className="inline-flex items-center gap-1 text-xs text-blue-400 transition-colors hover:text-blue-300"
              >
                Terms of Service
                <ExternalLink className="h-3 w-3" />
              </Link>
              <span className="text-zinc-700">|</span>
              <Link
                href="/legal/privacy"
                className="inline-flex items-center gap-1 text-xs text-blue-400 transition-colors hover:text-blue-300"
              >
                Privacy Policy
                <ExternalLink className="h-3 w-3" />
              </Link>
              <span className="text-zinc-700">|</span>
              <Link
                href="/legal/risk-disclosure"
                className="inline-flex items-center gap-1 text-xs text-blue-400 transition-colors hover:text-blue-300"
              >
                Risk Disclosure
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Footer with checkbox and button */}
          <div className="border-t border-white/5 px-6 pt-5 pb-6">
            {/* Checkbox */}
            <label className="group flex cursor-pointer items-start gap-3">
              <div className="relative mt-0.5 flex items-center">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="peer h-4.5 w-4.5 cursor-pointer appearance-none rounded border border-zinc-600 bg-zinc-800 transition-colors checked:border-blue-500 checked:bg-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
                <svg
                  className="pointer-events-none absolute left-0 h-4.5 w-4.5 text-white opacity-0 peer-checked:opacity-100"
                  viewBox="0 0 18 18"
                  fill="none"
                >
                  <path
                    d="M5 9l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-sm leading-snug text-zinc-300 transition-colors select-none group-hover:text-zinc-200">
                I have read and understand the risks. I acknowledge that this
                tool provides educational analysis only and is not financial
                advice.
              </span>
            </label>

            {/* Accept button */}
            <button
              onClick={handleAccept}
              disabled={!checked}
              className="mt-5 w-full rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:opacity-30"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
