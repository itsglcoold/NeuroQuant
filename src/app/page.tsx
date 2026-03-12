import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Brain,
  ImageIcon,
  Globe,
  Activity,
  TrendingUp,
  ArrowRight,
  Zap,
  Shield,
  ChevronRight,
  Clock,
  RefreshCw,
  Layers,
} from "lucide-react";
import { MARKETS, MARKET_CATEGORIES, CATEGORY_COLORS } from "@/lib/market/symbols";
import { MarketCategory } from "@/types/market";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    icon: Brain,
    title: "Triple-AI Consensus",
    description:
      "Three independent AI models — two for technical, one for fundamental analysis — cross-validate for maximum reliability.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: ImageIcon,
    title: "Chart Analysis",
    description:
      "Upload any chart screenshot for instant AI pattern recognition. Support lines, channels, and formations detected automatically.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: Globe,
    title: "All Markets",
    description:
      "Gold, Silver, Oil, Forex pairs, S&P 500, and NASDAQ. Every major market covered in a single platform.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Activity,
    title: "Real-time Data",
    description:
      "Market data refreshes every 60 seconds. Charts from 1-minute to monthly candles with RSI, MACD, Bollinger Bands, and SMA overlays.",
    gradient: "from-orange-500 to-amber-500",
  },
];

const categoryIcons: Record<string, typeof BarChart3> = {
  metals: Shield,
  energy: Zap,
  forex: Globe,
  indices: TrendingUp,
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="NeuroQuant" width={120} height={80} className="h-8 w-auto dark:brightness-100 brightness-0" priority />
            <div>
              <span className="text-lg font-semibold tracking-tight leading-none">
                NeuroQuant
              </span>
              <span className="hidden sm:block text-xs font-bold text-foreground leading-none mt-0.5">
                AI Analyst Assistant
              </span>
            </div>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#markets"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Markets
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-32">
        {/* Background gradient effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px]" />
          <div className="absolute right-1/4 top-1/4 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-500 dark:text-blue-400">
              <Zap className="h-3.5 w-3.5" />
              Powered by Triple-AI Consensus Engine
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              AI-Powered{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Market Analysis
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Three independent AI models analyze every market signal and reach
              consensus for maximum reliability. Get institutional-grade
              insights for Gold, Forex, and major indices.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth/signup"
                className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/25"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-6 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent"
              >
                View Dashboard
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 py-8 sm:grid-cols-4 sm:gap-8 sm:py-12">
            {[
              {
                icon: RefreshCw,
                value: "5s",
                label: "Fastest refresh",
                detail: "Pro: 5s · Premium: real-time",
              },
              {
                icon: Layers,
                value: "1m–1M",
                label: "Chart timeframes",
                detail: "Scalp to swing trading",
              },
              {
                icon: Brain,
                value: "3",
                label: "AI engines",
                detail: "Technical + fundamental",
              },
              {
                icon: Clock,
                value: "25+",
                label: "Markets covered",
                detail: "Metals, Forex & Indices",
              },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <stat.icon className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {stat.value}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {stat.label}
                </p>
                <p className="text-xs text-muted-foreground">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                trade smarter
              </span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Advanced AI analysis, real-time data, and comprehensive market
              coverage in one platform.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:border-border/80 hover:bg-accent"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}
                >
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Markets Section */}
      <section id="markets" className="relative py-20 sm:py-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-0 bottom-0 h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Supported Markets
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Comprehensive coverage across commodities, currencies, and
              indices.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Metals */}
            {(() => {
              const metalsMarkets = MARKETS.filter((m) => m.category === "metals");
              const metalColors = CATEGORY_COLORS["metals"];
              return (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${metalColors?.bg}`}>
                      <Shield className={`h-5 w-5 ${metalColors?.text}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Metals</h3>
                      <p className="text-xs text-muted-foreground">Gold &amp; Silver</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {metalsMarkets.map((market) => (
                      <div key={market.symbol} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded ${metalColors?.bg} text-sm`}>{market.emoji}</span>
                        <span className="text-sm text-foreground">{market.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Energy + Indices combined */}
            {(() => {
              const energyMarkets = MARKETS.filter((m) => m.category === "energy");
              const indicesMarkets = MARKETS.filter((m) => m.category === "indices");
              const energyColors = CATEGORY_COLORS["energy"];
              const indicesColors = CATEGORY_COLORS["indices"];
              return (
                <div className="rounded-2xl border border-border bg-card p-6">
                  {/* Energy */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${energyColors?.bg}`}>
                      <Zap className={`h-5 w-5 ${energyColors?.text}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Energy</h3>
                      <p className="text-xs text-muted-foreground">Crude Oil</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {energyMarkets.map((market) => (
                      <div key={market.symbol} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded ${energyColors?.bg} text-sm`}>{market.emoji}</span>
                        <span className="text-sm text-foreground">{market.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="my-5 border-t border-border" />

                  {/* Indices */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${indicesColors?.bg}`}>
                      <TrendingUp className={`h-5 w-5 ${indicesColors?.text}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Indices</h3>
                      <p className="text-xs text-muted-foreground">DXY, S&amp;P 500 &amp; NASDAQ</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {indicesMarkets.map((market) => (
                      <div key={market.symbol} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded ${indicesColors?.bg} text-sm`}>{market.emoji}</span>
                        <span className="text-sm text-foreground">{market.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Forex — 2-column layout */}
            {(() => {
              const forexMarkets = MARKETS.filter((m) => m.category === "forex");
              const forexColors = CATEGORY_COLORS["forex"];
              const MAX_VISIBLE = 10;
              const visibleForex = forexMarkets.slice(0, MAX_VISIBLE);
              const hiddenCount = forexMarkets.length - MAX_VISIBLE;
              return (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${forexColors?.bg}`}>
                      <Globe className={`h-5 w-5 ${forexColors?.text}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Forex</h3>
                      <p className="text-xs text-muted-foreground">{forexMarkets.length} Currency Pairs</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {visibleForex.map((market) => (
                      <div key={market.symbol} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded ${forexColors?.bg} text-xs`}>{market.emoji}</span>
                        <span className="text-sm text-foreground">{market.symbol}</span>
                      </div>
                    ))}
                  </div>
                  {hiddenCount > 0 && (
                    <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        +{hiddenCount} more pairs
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-blue-500/10 via-card to-cyan-500/10 p-8 sm:p-16">
            <div className="absolute inset-0 -z-10">
              <div className="absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-[80px]" />
            </div>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Start analyzing markets with AI
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Join traders using multi-AI consensus for smarter decisions.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-3 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/25"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  View Pricing
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="NeuroQuant" width={90} height={60} className="h-7 w-auto dark:brightness-100 brightness-0" />
              <div>
                <span className="text-sm font-semibold leading-none">NeuroQuant</span>
                <span className="block text-xs font-bold text-foreground leading-none mt-0.5">AI Analyst Assistant</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <Link
                href="/pricing"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/auth/login"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign In
              </Link>
              <Link
                href="/legal/terms"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms
              </Link>
              <Link
                href="/legal/privacy"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                href="/legal/risk-disclosure"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Risk Disclosure
              </Link>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-8">
            <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
              Disclaimer: NeuroQuant provides AI-generated analysis for
              informational purposes only. This is not financial advice. Trading
              involves significant risk of loss. Past performance does not
              guarantee future results. Always conduct your own research and
              consult a qualified financial advisor before making investment
              decisions.
            </p>
            <p className="mt-4 text-center text-xs font-medium text-muted-foreground/70">
              NeuroQuant: Powered by Triple-AI with upcoming autonomous Risk-Shield technology.
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground/50">
              &copy; {new Date().getFullYear()} NeuroQuant. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
