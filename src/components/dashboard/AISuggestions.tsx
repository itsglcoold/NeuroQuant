"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Crown,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Lock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Clock,
  Zap,
  BarChart3,
  TrendingUp as TrendIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserTier } from "@/hooks/useUsageTracking";
import { useAISuggestions } from "@/hooks/useAISuggestions";
import { UpgradeModal } from "./UpgradeModal";
import type { MarketSuggestion, SuggestionRow } from "@/types/analysis";

interface AISuggestionsProps {
  tier: UserTier;
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "bullish")
    return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (direction === "bearish")
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-amber-500" />;
}

function DirectionBadge({ direction }: { direction: string }) {
  const colors = {
    bullish: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    bearish: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    neutral: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", colors[direction as keyof typeof colors] || colors.neutral)}>
      <DirectionIcon direction={direction} />
      {direction}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-secondary">
        <div
          className={cn("h-1.5 rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{value}%</span>
    </div>
  );
}

const HOVER_COLORS: Record<string, string> = {
  red: "hover:border-red-500/50 hover:shadow-red-500/5",
  blue: "hover:border-blue-500/50 hover:shadow-blue-500/5",
  amber: "hover:border-amber-500/50 hover:shadow-amber-500/5",
};

function getDxyLabel(direction: string): string {
  if (direction === "bullish") return "USD Strengthening";
  if (direction === "bearish") return "USD Weakening";
  return "USD Neutral";
}

function SuggestionCard({ suggestion, hoverColor = "blue", tradingStyle }: { suggestion: MarketSuggestion; hoverColor?: string; tradingStyle?: string }) {
  const hoverClass = HOVER_COLORS[hoverColor] || HOVER_COLORS.blue;
  const isDxy = suggestion.symbol === "DXY";
  const styleParam = tradingStyle ? `?style=${tradingStyle}` : "";
  return (
    <Link
      href={`/dashboard/market/${encodeURIComponent(suggestion.symbol)}${styleParam}`}
      prefetch={false}
      className={cn("group flex min-w-[220px] flex-col rounded-lg border border-border bg-card p-4 transition-all hover:shadow-md snap-start", hoverClass)}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{suggestion.emoji}</span>
          <div>
            <div className="text-sm font-semibold text-foreground">{suggestion.symbol}</div>
            <div className="text-[10px] text-muted-foreground">{isDxy ? "Dollar Sentiment" : suggestion.name}</div>
          </div>
        </div>
        {isDxy ? (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
            suggestion.direction === "bullish"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              : suggestion.direction === "bearish"
              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          )}>
            <DirectionIcon direction={suggestion.direction} />
            {suggestion.direction === "bullish" ? "Strong $" : suggestion.direction === "bearish" ? "Weak $" : "Neutral $"}
          </span>
        ) : (
          <DirectionBadge direction={suggestion.direction} />
        )}
      </div>

      {/* Sentiment Label */}
      <div className={cn(
        "mb-2 text-xs font-semibold",
        suggestion.direction === "bullish" ? "text-emerald-600 dark:text-emerald-400" :
        suggestion.direction === "bearish" ? "text-red-600 dark:text-red-400" :
        "text-amber-600 dark:text-amber-400"
      )}>
        {isDxy ? getDxyLabel(suggestion.direction) : suggestion.sentimentLabel}
      </div>

      {/* Confidence */}
      <div className="mb-2">
        <div className="mb-0.5 text-[10px] text-muted-foreground">Confidence</div>
        <ConfidenceBar value={suggestion.confidence} />
      </div>

      {/* Probability Alignment */}
      <div className="mb-3 flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Probability Alignment</span>
        <span className="font-semibold text-foreground">{suggestion.probabilityAlignment}%</span>
      </div>

      {/* Timeframe + Key Level */}
      <div className="mb-3 flex items-center gap-1.5">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", ROW_BADGE_COLORS[hoverColor] || ROW_BADGE_COLORS.blue)}>
          {suggestion.timeframe}
        </span>
        {suggestion.keyLevel > 0 && (
          <span className="ml-auto flex flex-col items-end text-[10px] font-mono text-muted-foreground leading-tight">
            <span>Key Level:</span>
            <span className="font-semibold text-foreground/80">{typeof suggestion.keyLevel === "number" ? suggestion.keyLevel.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : suggestion.keyLevel}</span>
          </span>
        )}
      </div>

      {/* Reasoning */}
      <p className="mb-3 flex-1 text-[11px] leading-relaxed text-muted-foreground">
        {suggestion.reasoning}
      </p>

      {/* CTA */}
      <div className="flex items-center gap-1 text-xs font-medium text-blue-500">
        Full Analysis <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="flex min-w-[220px] flex-col rounded-lg border border-border bg-card p-4 snap-start">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded bg-secondary" />
          <div>
            <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
            <div className="mt-1 h-3 w-12 animate-pulse rounded bg-secondary" />
          </div>
        </div>
        <div className="h-5 w-16 animate-pulse rounded-full bg-secondary" />
      </div>
      <div className="mb-2 h-4 w-32 animate-pulse rounded bg-secondary" />
      <div className="mb-2 h-1.5 w-full animate-pulse rounded bg-secondary" />
      <div className="mb-3 h-3 w-24 animate-pulse rounded bg-secondary" />
      <div className="mb-3 space-y-1">
        <div className="h-3 w-full animate-pulse rounded bg-secondary" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
      </div>
    </div>
  );
}

const ROW_ICONS: Record<string, React.ReactNode> = {
  scalping: <Zap className="h-3.5 w-3.5" />,
  daytrading: <BarChart3 className="h-3.5 w-3.5" />,
  swing: <TrendIcon className="h-3.5 w-3.5" />,
};

const ROW_BADGE_COLORS: Record<string, string> = {
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const ROW_BORDER_COLORS: Record<string, string> = {
  red: "border-l-red-500",
  blue: "border-l-blue-500",
  amber: "border-l-amber-500",
};

function RowSection({ row }: { row: SuggestionRow }) {
  const badgeClass = ROW_BADGE_COLORS[row.badgeColor] || ROW_BADGE_COLORS.blue;
  const borderClass = ROW_BORDER_COLORS[row.badgeColor] || ROW_BORDER_COLORS.blue;
  const icon = ROW_ICONS[row.key] || <BarChart3 className="h-3.5 w-3.5" />;

  return (
    <div className={cn("mb-6 last:mb-0 rounded-lg border-l-4 bg-secondary/20 p-4", borderClass)}>
      {/* Row Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded", badgeClass)}>
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{row.label}</h3>
        <span className="text-[11px] text-muted-foreground italic">{row.subtitle}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", badgeClass)}>
          {row.timeframeFocus}
        </span>
      </div>

      {/* Cards — horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-5">
        {row.suggestions.map((s) => (
          <SuggestionCard key={`${s.symbol}-${row.key}`} suggestion={s} hoverColor={row.badgeColor} tradingStyle={row.key} />
        ))}
      </div>
    </div>
  );
}

function LockedContent({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="relative">
      {/* Blurred teaser cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 blur-[6px] pointer-events-none select-none">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🥇</span>
              <div>
                <div className="text-sm font-semibold">XAU/USD</div>
                <div className="text-[10px] text-muted-foreground">Gold</div>
              </div>
            </div>
            <div className="mb-2 text-xs font-semibold text-emerald-500">Strong Bullish Momentum</div>
            <div className="mb-2 h-1.5 rounded-full bg-secondary">
              <div className="h-1.5 w-3/4 rounded-full bg-emerald-500" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              RSI approaching oversold territory while MACD momentum shifts...
            </p>
          </div>
        ))}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
            <Lock className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Market Suggestions</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Upgrade to Pro to see AI-identified opportunities across all markets
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 transition-transform hover:scale-105"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Unlock AI Suggestions
          </button>
        </div>
      </div>
    </div>
  );
}

export function AISuggestions({ tier }: AISuggestionsProps) {
  const { rows, suggestions, loading, refreshing, error, lastUpdated, isStale, refetch } = useAISuggestions(tier);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nq_suggestions_collapsed") === "true";
  });
  const [showUpgrade, setShowUpgrade] = useState(false);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("nq_suggestions_collapsed", String(next));
  };

  const canAccess = tier === "pro" || tier === "premium";
  const totalShown = rows.reduce((sum, r) => sum + r.suggestions.length, 0);
  const maxPerRow = tier === "premium" ? 5 : 3;

  return (
    <section>
      {/* Header */}
      <button
        onClick={toggleCollapse}
        className="mb-4 flex w-full items-center gap-2 text-left"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-amber-500/20 to-orange-500/20">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">AI Market Research</h2>
        {!canAccess && (
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-500 border border-blue-500/20">
            PRO
          </span>
        )}
        {canAccess && tier !== "premium" && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500 border border-amber-500/20">
            {maxPerRow} per row
          </span>
        )}
        {canAccess && tier === "premium" && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500 border border-amber-500/20">
            <Crown className="mr-1 inline h-3 w-3" />PREMIUM
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canAccess && lastUpdated && !refreshing && (
            <span className="text-[10px] text-muted-foreground">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {/* Show Rescan button only when actively scanning OR when data is stale/old (>5 min) */}
          {canAccess && !loading && (refreshing || isStale || !lastUpdated || (lastUpdated && Date.now() - lastUpdated.getTime() > 5 * 60 * 1000)) && (
            <button
              title="Rescan markets with AI"
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                refreshing
                  ? "bg-blue-500/10 text-blue-500"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (!refreshing) refetch();
              }}
            >
              <Sparkles className={cn("h-3 w-3", refreshing && "animate-pulse")} />
              {refreshing ? "Scanning…" : "Rescan"}
            </button>
          )}
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {!collapsed && (
        <>
          {/* Free — locked */}
          {!canAccess && (
            <LockedContent onUpgrade={() => setShowUpgrade(true)} />
          )}

          {/* Pro/Premium — loading state */}
          {canAccess && loading && (
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 py-2.5 px-4">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Scanning 15 markets across 3 trading styles…
                </span>
              </div>
              {/* Skeleton rows */}
              {["Scalping", "Day Trading", "Swing Trading"].map((label) => (
                <div key={label}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-4 w-4 animate-pulse rounded bg-secondary" />
                    <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
                    <div className="h-4 w-16 animate-pulse rounded-full bg-secondary" />
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-5">
                    {Array.from({ length: maxPerRow }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {canAccess && error && !loading && (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={refetch}
                className="mt-2 text-xs font-medium text-blue-500 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Rows with suggestions */}
          {canAccess && !loading && !error && rows.length > 0 && (
            <>
              {/* Quick scan disclaimer */}
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Quick scan based on price action only.</span>{" "}
                  This overview does not use technical indicators. Tap any tile to run a full analysis with RSI, MACD, and more before trading.
                </p>
              </div>

              {rows.map((row) => (
                <RowSection key={row.key} row={row} />
              ))}

              {tier === "pro" && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    Showing {totalShown} of 15 signals ({maxPerRow} per row)
                  </span>
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="text-[10px] font-semibold text-amber-500 hover:underline"
                  >
                    Upgrade to Premium for all 15
                  </button>
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {canAccess && !loading && !error && rows.length === 0 && suggestions.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                AI is scanning markets for opportunities...
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-3 text-center text-[10px] text-muted-foreground/60">
            Quick directional scan based on price action — not a substitute for full technical analysis.
            For educational purposes only. Not financial advice. Past patterns do not guarantee future results.
          </p>
        </>
      )}

      {/* Upgrade modal */}
      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="ai-suggestions"
        requiredTier={tier === "pro" ? "premium" : "pro"}
      />
    </section>
  );
}
