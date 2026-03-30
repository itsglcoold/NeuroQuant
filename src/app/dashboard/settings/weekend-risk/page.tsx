"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
        checked ? "bg-blue-500" : "bg-muted"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform",
        checked ? "translate-x-5" : "translate-x-0"
      )} />
    </button>
  );
}
import {
  getWeekendRiskSettings,
  saveWeekendRiskSettings,
  getWeekendRisk,
  getMarketSessionStatus,
  DEFAULT_WEEKEND_RISK_SETTINGS,
  type WeekendRiskSettings,
} from "@/lib/weekend-risk";

export default function WeekendRiskSettingsPage() {
  const [settings, setSettings] = useState<WeekendRiskSettings>(DEFAULT_WEEKEND_RISK_SETTINGS);
  const [saved, setSaved] = useState(false);
  const weekendRisk = getWeekendRisk();
  const session = getMarketSessionStatus();

  useEffect(() => {
    setSettings(getWeekendRiskSettings());
  }, []);

  function handleSave() {
    saveWeekendRiskSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-amber-500" />
          Weekend Risk Manager
        </h1>
        <p className="text-muted-foreground mt-1">
          Protect your trades against weekend gaps. Markets close Friday evening and reopen Sunday night — gaps can skip your SL/TP entirely.
        </p>
      </div>

      {/* Current status */}
      <Card className={weekendRisk.isRisky ? "border-amber-500/30 bg-amber-500/5" : "border-green-500/30 bg-green-500/5"}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className={`h-5 w-5 ${weekendRisk.isRisky ? "text-amber-500" : "text-green-500"}`} />
            <div>
              <p className={`text-sm font-semibold ${weekendRisk.isRisky ? "text-amber-500" : "text-green-500"}`}>
                {weekendRisk.isClosed ? "Markets Closed" : weekendRisk.isRisky ? "Weekend Risk Active" : "Normal Trading Hours"}
              </p>
              <p className="text-xs text-muted-foreground">
                {session.nextEventLabel}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Warnings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Warn before Friday trades</p>
              <p className="text-xs text-muted-foreground mt-0.5">Show a warning banner when opening trades on Friday</p>
            </div>
            <Toggle checked={settings.warnOnFriday} onChange={(v) => setSettings({ ...settings, warnOnFriday: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Position sizing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Position Sizing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Reduce position size on Fridays</p>
              <p className="text-xs text-muted-foreground mt-0.5">Automatically reduce lot size to limit weekend exposure</p>
            </div>
            <Toggle checked={settings.reducePositionSize} onChange={(v) => setSettings({ ...settings, reducePositionSize: v })} />
          </div>

          {settings.reducePositionSize && (
            <div className="space-y-2 pt-1">
              <p className="text-sm">Size multiplier on Friday</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={settings.reduceMultiplier}
                  onChange={(e) => setSettings({ ...settings, reduceMultiplier: parseFloat(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm font-semibold tabular-nums w-12 text-right">
                  {Math.round(settings.reduceMultiplier * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {settings.reduceMultiplier < 1
                  ? `Friday lot sizes will be ${Math.round(settings.reduceMultiplier * 100)}% of normal`
                  : "No reduction — full position size on Fridays"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 pb-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Why weekend gaps are dangerous</p>
          <p>When markets reopen on Sunday night (22:00 UTC), price can jump significantly from Friday&apos;s close (22:00 UTC) — skipping your Stop Loss entirely. This results in a larger loss than expected.</p>
          <p>Forex majors typically gap 5–30 pips. Indices and metals can gap 0.3–1%+. News over the weekend (geopolitical events, economic data) is the main cause.</p>
          <p className="text-foreground/60 font-medium">All times are based on UTC market hours, regardless of your local timezone.</p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        {saved ? (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        ) : (
          "Save Settings"
        )}
      </Button>
    </div>
  );
}
