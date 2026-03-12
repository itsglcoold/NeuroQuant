"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  Upload,
  MessageSquare,
  Newspaper,
  CalendarDays,
  Settings,
  Menu,
  ChevronDown,
  ChevronRight,
  Home,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MARKETS, MARKET_CATEGORIES, CATEGORY_COLORS } from "@/lib/market/symbols";
import type { MarketCategory } from "@/types/market";

interface MarketChild {
  label: string;
  href: string;
  icon?: string;
  emoji?: string;
  colorBg?: string;
  colorText?: string;
  category?: string;
}

interface NavItem {
  label: string;
  href?: string;
  icon: typeof BarChart3;
  badge?: "PRO" | "PREMIUM";
  children?: MarketChild[];
}

// Auto-generate market children from MARKETS, grouped by category
// Use symbol for forex (EUR/USD), full name for metals/energy/indices (Gold, S&P 500)
const marketChildren: MarketChild[] = (
  Object.keys(MARKET_CATEGORIES) as MarketCategory[]
).flatMap((cat) => {
  const colors = CATEGORY_COLORS[cat];
  return MARKETS.filter((m) => m.category === cat).map((m) => ({
    label: cat === "forex" ? m.symbol : m.name,
    href: `/dashboard/market/${encodeURIComponent(m.symbol)}`,
    icon: m.icon,
    emoji: m.emoji,
    colorBg: colors.bg,
    colorText: colors.text,
    category: cat,
  }));
});

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: Home,
  },
  {
    label: "Markets",
    icon: TrendingUp,
    children: marketChildren,
  },
  {
    label: "Market News",
    href: "/dashboard/news",
    icon: Newspaper,
  },
  {
    label: "Economic Calendar",
    href: "/dashboard/calendar",
    icon: CalendarDays,
  },
  {
    label: "Chart Upload",
    href: "/dashboard/upload",
    icon: Upload,
    badge: "PRO",
  },
  {
    label: "AI Chat",
    href: "/dashboard/chat",
    icon: MessageSquare,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Markets"]);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <Link href="/dashboard" className="flex h-16 items-center gap-2 px-4 transition-opacity hover:opacity-80">
        <Image src="/logo.png" alt="NQ" width={100} height={67} className="h-8 w-auto dark:brightness-100 brightness-0" />
        <div>
          <span className="text-sm font-semibold tracking-tight leading-none">
            NeuroQuant
          </span>
          <span className="block text-xs font-bold text-foreground leading-none mt-0.5">
            AI Market Research
          </span>
        </div>
      </Link>

      <Separator className="bg-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive =
              item.href === pathname ||
              item.children?.some((child) => child.href === pathname);
            const isExpanded = expandedItems.includes(item.label);

            if (item.children) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="mt-1 ml-4 space-y-0.5 border-l border-border pl-3">
                      {item.children.map((child, idx) => {
                        // Add category header when category changes
                        const prevChild = idx > 0 ? item.children![idx - 1] : null;
                        const showCategoryHeader = child.category && child.category !== prevChild?.category;
                        const catLabel = child.category ? MARKET_CATEGORIES[child.category as MarketCategory]?.label : null;

                        return (
                          <div key={child.href}>
                            {showCategoryHeader && (
                              <p className={cn("px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60", idx === 0 && "pt-0.5")}>
                                {catLabel}
                              </p>
                            )}
                            <Link
                              href={child.href}
                              onClick={onNavigate}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg px-3 py-1 text-sm transition-colors",
                                child.href === pathname
                                  ? "bg-blue-500/10 text-blue-500 dark:text-blue-400"
                                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
                              )}
                            >
                              {child.emoji ? (
                                <span className={cn("flex h-5 w-5 items-center justify-center rounded text-xs", child.colorBg || "bg-muted")}>
                                  {child.emoji}
                                </span>
                              ) : child.icon ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[8px] font-bold text-muted-foreground">
                                  {child.icon}
                                </span>
                              ) : null}
                              <span className="truncate text-xs">{child.label}</span>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href!}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  item.href === pathname
                    ? "bg-blue-500/10 text-blue-500 dark:text-blue-400"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className={cn(
                    "rounded px-1 py-0.5 text-[9px] font-bold leading-none",
                    item.badge === "PRO"
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-amber-500/10 text-amber-500"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-border" />

      {/* Bottom section */}
      <div className="p-4">
        <UsageWidget />
      </div>

      {/* Persistent legal disclaimer reminder */}
      <div className="border-t border-border px-4 py-2.5">
        <p className="text-[10px] leading-tight text-muted-foreground/60">
          AI analysis: Not financial advice.{" "}
          <Link href="/legal/risk-disclosure" className="underline hover:text-muted-foreground transition-colors">
            Risk Disclosure
          </Link>
        </p>
      </div>
    </div>
  );
}

function UsageWidget() {
  const { tier, analysesRemaining, analysesTotal } = useUsageTracking();
  const usedPercent = analysesTotal === Infinity
    ? 0
    : ((analysesTotal - analysesRemaining) / analysesTotal) * 100;

  const tierLabel = tier === "free" ? "Free Plan" : tier === "pro" ? "Pro Plan" : "Premium Plan";
  const isLow = analysesRemaining <= 1 && tier === "free";

  if (tier === "premium") {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <p className="text-xs font-medium text-foreground/80">{tierLabel}</p>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Unlimited analyses
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border p-3",
      isLow ? "border-red-500/30 bg-red-500/5" : "border-border bg-secondary/50"
    )}>
      <p className="text-xs font-medium text-foreground/80">{tierLabel}</p>
      <p className={cn(
        "mt-0.5 text-[10px]",
        isLow ? "font-semibold text-red-500" : "text-muted-foreground"
      )}>
        {analysesRemaining} of {analysesTotal} analyses remaining
      </p>
      {/* Progress bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isLow
              ? "bg-red-500"
              : usedPercent > 60
                ? "bg-amber-500"
                : "bg-blue-500"
          )}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
      {tier === "free" && (
        <Link
          href="/pricing"
          className="mt-2 block rounded-md bg-gradient-to-r from-blue-500 to-cyan-500 py-1 text-center text-[11px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Upgrade to Pro
        </Link>
      )}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r border-border bg-background lg:block">
      <SidebarNav />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={(value) => setOpen(value)}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="lg:hidden" />
        }
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation</span>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-64 border-border bg-background p-0"
        showCloseButton={false}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
