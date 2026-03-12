import Link from "next/link";
import { Check, BarChart3, ArrowLeft, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface Feature {
  text: string;
  soon?: boolean;
}

const plans: {
  name: string;
  price: string;
  period: string;
  description: string;
  highlighted: boolean;
  features: Feature[];
  cta: string;
  href: string;
}[] = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Explore AI-powered market insights — no card needed",
    highlighted: false,
    features: [
      { text: "3 AI analyses per day" },
      { text: "5 markets (Gold, EUR/USD & more)" },
      { text: "60-second data refresh" },
      { text: "Single AI model analysis" },
      { text: "Daily market summary", soon: true },
      { text: "Community support" },
    ],
    cta: "Start Free",
    href: "/auth/signup",
  },
  {
    name: "Pro",
    price: "$19.99",
    period: "/mo",
    description: "For traders who want an edge — faster data, smarter AI",
    highlighted: true,
    features: [
      { text: "50 AI analyses per day" },
      { text: "All 25+ markets covered" },
      { text: "5-second data refresh", soon: true },
      { text: "Triple-AI consensus engine" },
      { text: "Upload charts for AI pattern recognition" },
      { text: "RSI, MACD, Bollinger & more indicators" },
      { text: "Custom alerts & notifications", soon: true },
      { text: "Priority support" },
    ],
    cta: "Start Pro Trial",
    href: "/auth/signup?plan=pro",
  },
  {
    name: "Premium",
    price: "$49.99",
    period: "/mo",
    description: "Institutional-grade tools — built for serious professionals",
    highlighted: false,
    features: [
      { text: "Unlimited AI analyses" },
      { text: "All 25+ markets covered" },
      { text: "Real-time data refresh", soon: true },
      { text: "Triple-AI consensus engine" },
      { text: "Upload charts for AI pattern recognition" },
      { text: "Advanced technical indicators" },
      { text: "Custom alerts & notifications", soon: true },
      { text: "AI Chat — ask anything about any market" },
      { text: "Historical analysis reports", soon: true },
      { text: "API access for your own tools", soon: true },
      { text: "Dedicated 1-on-1 support" },
    ],
    cta: "Start Premium Trial",
    href: "/auth/signup?plan=premium",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-semibold tracking-tight leading-none">
                NeuroQuant
              </span>
              <span className="hidden sm:block text-[10px] text-muted-foreground leading-none mt-0.5">
                AI Analyst Assistant
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Simple,{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              transparent
            </span>{" "}
            pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the plan that fits your trading needs. Upgrade or downgrade
            at any time.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:items-start">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative ${plan.highlighted ? "pt-4" : ""}`}>
              {plan.highlighted && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <span className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/25">
                    Most Popular
                  </span>
                </div>
              )}
              <Card
                className={`relative flex flex-col ${
                  plan.highlighted
                    ? "border-2 border-blue-500 bg-gradient-to-b from-blue-500/10 via-card to-card shadow-2xl shadow-blue-500/10 scale-[1.02] lg:scale-105"
                    : "ring-1 ring-border"
                }`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className={`text-lg ${plan.highlighted ? "text-blue-400" : ""}`}>
                    {plan.name}
                  </CardTitle>
                  <CardDescription className={plan.highlighted ? "text-foreground/70" : ""}>
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-6">
                    <span className="text-4xl font-bold">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.text}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        {feature.soon ? (
                          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        ) : (
                          <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? "text-cyan-400" : "text-blue-500"}`} />
                        )}
                        <span className={feature.soon ? "text-muted-foreground" : plan.highlighted ? "text-foreground/90" : "text-foreground/80"}>
                          {feature.text}
                          {feature.soon && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              SOON
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="border-0 bg-transparent p-4">
                  <Link
                    href={plan.href}
                    className={`block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-all ${
                      plan.highlighted
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/25"
                        : "border border-border bg-secondary text-foreground hover:bg-accent"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </CardFooter>
              </Card>
            </div>
          ))}
        </div>

        {/* Trust signals */}
        <div className="mx-auto mt-16 max-w-2xl text-center space-y-3">
          <p className="text-sm font-medium text-foreground">
            All paid plans include a 7-day free trial. No credit card required to start.
          </p>
          <p className="text-xs text-muted-foreground">
            Cancel anytime · Upgrade or downgrade instantly · Your data is always yours
          </p>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-center text-2xl font-bold tracking-tight mb-8">
            Frequently asked questions
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                q: "I'm new to trading — is Free enough?",
                a: "Absolutely. The Free plan gives you AI-powered analysis on major markets like Gold and EUR/USD. It's the perfect way to learn how markets move with AI guidance.",
              },
              {
                q: "What is Triple-AI consensus?",
                a: "Three independent AI models analyze the same market — two for technicals, one for fundamentals. When all three agree, you get a high-confidence signal. Available on Pro and Premium.",
              },
              {
                q: "How fast is the data refresh?",
                a: "Currently all plans refresh every 60 seconds. We're rolling out faster tiers soon — Pro will get 5-second refresh, Premium gets real-time streaming. Faster data means faster decisions.",
              },
              {
                q: "Can I upload my own charts?",
                a: "Yes! Pro and Premium users can upload any chart screenshot. Our AI detects patterns, support/resistance lines, and formations automatically.",
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
