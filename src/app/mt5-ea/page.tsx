import { Download, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: 1,
    title: "Download the EA",
    desc: "Click the download button below and save the .mq5 file.",
  },
  {
    n: 2,
    title: "Copy to MT5",
    desc: "Copy NeuroQuant_Bridge.mq5 to your MT5 folder:\nFile > Open Data Folder > MQL5 > Experts",
  },
  {
    n: 3,
    title: "Compile in MetaEditor",
    desc: "Open the file in MetaEditor and press F7 (or click Build). There should be no errors.",
  },
  {
    n: 4,
    title: "Allow WebRequest",
    desc: "In MT5: Tools > Options > Expert Advisors\nCheck: Allow WebRequest for listed URL\nAdd: https://neuroquant.app",
  },
  {
    n: 5,
    title: "Attach to a chart",
    desc: "Pick any chart (e.g. EURUSD H1). Enter your Webhook URL and Secret from NeuroQuant > Live Trading. Enable Allow live trading. Click OK.",
  },
  {
    n: 6,
    title: "Done!",
    desc: "Your trades will now appear automatically in the NeuroQuant dashboard.",
  },
];

export default function Mt5EaPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full mb-4">
            MetaTrader 5 · Expert Advisor
          </div>
          <h1 className="text-3xl font-bold mb-3">NeuroQuant Bridge EA</h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Connect your MT5 terminal to NeuroQuant. All open trades
            appear in real-time on your dashboard. Close any trade with
            one click from your browser — the EA executes it in MT5.
          </p>
        </div>

        {/* Download button */}
        <div className="flex justify-center mb-12">
          <a href="/NeuroQuant_Bridge.mq5" download="NeuroQuant_Bridge.mq5">
            <Button size="lg" className="gap-2 px-8 py-6 text-base">
              <Download className="h-5 w-5" />
              Download NeuroQuant_Bridge.mq5
            </Button>
          </a>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-12">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
            Installation — 6 steps
          </h2>

          {STEPS.map((step) => (
            <div
              key={step.n}
              className="flex gap-4 p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                {step.n}
              </div>
              <div>
                <p className="font-medium text-sm mb-0.5">{step.title}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Requirements */}
        <div className="rounded-lg border border-border bg-card p-5 mb-8">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Requirements
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✓ MetaTrader 5 (build 2755 or newer)</li>
            <li>✓ NeuroQuant Premium subscription</li>
            <li>✓ MT5 terminal must stay open while trading</li>
            <li>✓ Internet access in MT5 (WebRequest must be allowed)</li>
          </ul>
        </div>

        {/* Warning */}
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-600 dark:text-yellow-400 flex gap-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            The EA only executes close commands that you initiate from
            the dashboard. It never opens trades on its own and never
            modifies existing positions unless you instruct it to.
          </p>
        </div>

        {/* Link back */}
        <div className="text-center mt-10">
          <a
            href="/dashboard/live-trading"
            className="text-sm text-primary hover:underline"
          >
            ← Back to Live Trading
          </a>
        </div>
      </div>
    </main>
  );
}
