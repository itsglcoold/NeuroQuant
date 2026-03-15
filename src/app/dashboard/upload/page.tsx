"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Image as ImageIcon, TrendingUp, TrendingDown, Minus, Lock, ClipboardPaste } from "lucide-react";
import { ChartAnalysisResult } from "@/types/analysis";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import Link from "next/link";
import React from "react";

// Render markdown-like text: **bold**, numbered lists, line breaks
function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  // Split by newlines first
  const lines = text.split(/\n/);
  return lines.map((line, i) => {
    // Process **bold** within each line
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    return (
      <p key={i} className={line.trim() === "" ? "h-1" : ""}>
        {rendered}
      </p>
    );
  });
}

const STYLE_BADGE_COLORS: Record<string, { border: string; bg: string; text: string; label: string }> = {
  scalping:    { border: "border-red-500/20",   bg: "bg-red-500/10",   text: "text-red-500",   label: "Scalping (1m / 5m)" },
  daytrading:  { border: "border-blue-500/20",  bg: "bg-blue-500/10",  text: "text-blue-500",  label: "Day Trading (15m / 1H)" },
  swing:       { border: "border-amber-500/20", bg: "bg-amber-500/10", text: "text-amber-500", label: "Swing Trading (4H / Daily)" },
};

export default function ChartUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ChartAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canAccessFeature, getRequiredTier } = useUsageTracking();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const hasAccess = canAccessFeature("chart-upload");

  const pasteZoneRef = useRef<HTMLDivElement>(null);

  // Handle paste events (from both global Ctrl+V and iOS paste callout)
  function handlePasteEvent(e: React.ClipboardEvent | ClipboardEvent) {
    const items = (e as ClipboardEvent).clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const pastedFile = new File([blob], `pasted-chart-${Date.now()}.png`, { type: blob.type });
          handleFileSelect(pastedFile);
        }
        // Clean up any text/html injected into the contentEditable
        if (pasteZoneRef.current) pasteZoneRef.current.textContent = "";
        return;
      }
    }
  }

  // Global paste listener for desktop (Ctrl+V / Cmd+V)
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      handlePasteEvent(e);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
          <Lock className="h-8 w-8 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold">Chart Upload is a Pro Feature</h1>
        <p className="mt-2 text-muted-foreground">
          Upload any chart screenshot and let our AI detect patterns, support/resistance levels, and formations automatically.
        </p>
        <Link
          href="/pricing"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-medium text-white hover:shadow-lg hover:shadow-blue-500/25"
        >
          Upgrade to Pro — $19.99/mo
        </Link>
      </div>
    );
  }

  function handleFileSelect(selectedFile: File) {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Please upload a PNG, JPG, or WebP image.");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File is too large. Maximum size is 5MB.");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function analyzeChart() {
    if (!file) return;

    setAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("chart", file);

      const res = await fetch("/api/analysis/chart", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        // Guard against non-JSON error responses (e.g. Cloudflare error pages)
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          throw new Error(data.error || "Analysis failed");
        }
        throw new Error(`Analysis failed (HTTP ${res.status}). Please try again.`);
      }

      const data = await res.json();
      setResult(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    }
    setAnalyzing(false);
  }

  const directionIcon = {
    bullish: <TrendingUp className="h-5 w-5 text-green-500" />,
    bearish: <TrendingDown className="h-5 w-5 text-red-500" />,
    neutral: <Minus className="h-5 w-5 text-yellow-500" />,
  };

  const directionColor = {
    bullish: "bg-green-500/10 text-green-500 border-green-500/20",
    bearish: "bg-red-500/10 text-red-500 border-red-500/20",
    neutral: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chart Analysis</h1>
        <p className="text-muted-foreground">Upload a chart screenshot and let AI analyze patterns and trends</p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="pt-6">
          {!preview ? (
            <div className="space-y-3">
              {/* Paste zone — tap to focus on iOS, then iOS shows "Paste" callout */}
              <div
                ref={pasteZoneRef}
                contentEditable
                suppressContentEditableWarning
                onPaste={(e) => handlePasteEvent(e)}
                onFocus={() => {
                  if (pasteZoneRef.current) pasteZoneRef.current.textContent = "";
                }}
                onInput={() => {
                  if (pasteZoneRef.current) pasteZoneRef.current.textContent = "";
                }}
                className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 px-4 py-8 text-center cursor-pointer transition-colors hover:bg-blue-500/10 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 caret-transparent select-none"
                role="button"
                tabIndex={0}
                aria-label="Tap to paste chart from clipboard"
              >
                <ClipboardPaste className="h-10 w-10 text-blue-500 pointer-events-none mb-1" />
                <span className="text-lg font-medium text-foreground pointer-events-none">Tap to paste copied chart</span>
                <span className="text-sm text-muted-foreground pointer-events-none">Long-press a chart → Copy Image → tap here</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground/60 uppercase tracking-wider">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Upload zone — screenshot or file browse */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/50 transition-colors"
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-base font-medium mb-1">Upload a screenshot</p>
                <p className="text-sm text-muted-foreground">Take a screenshot of your chart, then tap here to upload</p>
                <p className="text-xs text-muted-foreground/50 mt-1">PNG, JPG, WebP up to 5MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={preview}
                  alt="Chart preview"
                  className="w-full rounded-lg border border-border"
                />
                <button
                  onClick={clearFile}
                  className="absolute top-2 right-2 p-1 bg-secondary rounded-full hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{file?.name}</span>
                <span className="text-sm text-muted-foreground/70">
                  ({((file?.size || 0) / 1024).toFixed(0)} KB)
                </span>
              </div>
              <Button
                onClick={analyzeChart}
                disabled={analyzing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {analyzing ? "Analyzing with AI..." : "Analyze Chart"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="pt-6">
            <p className="text-red-500 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Analysis Result
                {directionIcon[result.direction]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Header badges */}
              <div className="flex flex-wrap gap-2">
                <Badge className={directionColor[result.direction]}>
                  {result.direction.toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  Confidence: {result.confidence}%
                </Badge>
                {result.detectedSymbol && (
                  <Badge variant="secondary">{result.detectedSymbol}</Badge>
                )}
                {result.detectedTimeframe && (
                  <Badge variant="secondary">⏱ {result.detectedTimeframe}</Badge>
                )}
                {result.detectedStyle && STYLE_BADGE_COLORS[result.detectedStyle] && (
                  <Badge className={`${STYLE_BADGE_COLORS[result.detectedStyle].bg} ${STYLE_BADGE_COLORS[result.detectedStyle].text} ${STYLE_BADGE_COLORS[result.detectedStyle].border} border`}>
                    {STYLE_BADGE_COLORS[result.detectedStyle].label}
                  </Badge>
                )}
              </div>

              {/* Sentiment strength label */}
              <div className="rounded-lg border p-3 text-center">
                <span className={`text-lg font-bold ${
                  result.confidence >= 70 && result.direction === "bullish" ? "text-green-500" :
                  result.confidence >= 70 && result.direction === "bearish" ? "text-red-500" :
                  "text-amber-500"
                }`}>
                  {result.direction === "bullish"
                    ? result.confidence >= 70 ? "Strong Bullish Momentum" : result.confidence >= 40 ? "Moderate Bullish" : "Slightly Bullish"
                    : result.direction === "bearish"
                    ? result.confidence >= 70 ? "Strong Bearish Exhaustion" : result.confidence >= 40 ? "Moderate Bearish" : "Slightly Bearish"
                    : "Neutral — Consolidation Phase"}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Probability Alignment: <span className="font-semibold">{result.confidence}%</span>
                </p>
              </div>

              {result.patterns.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground/80 mb-2">Detected Patterns</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.patterns.map((pattern, i) => (
                      <Badge key={i} variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30">
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {result.supportLevels.length > 0 && (
                  <div className="rounded-lg bg-green-500/5 border border-green-500/15 p-2.5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 mb-1.5">Support</h4>
                    {result.supportLevels.map((level, i) => (
                      <p key={i} className="text-sm tabular-nums font-medium text-foreground/80">{level}</p>
                    ))}
                  </div>
                )}
                {result.resistanceLevels.length > 0 && (
                  <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-2.5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1.5">Resistance</h4>
                    {result.resistanceLevels.map((level, i) => (
                      <p key={i} className="text-sm tabular-nums font-medium text-foreground/80">{level}</p>
                    ))}
                  </div>
                )}
              </div>

              {result.indicators.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground/80 mb-2">Indicator Readings</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {result.indicators.map((ind, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span>{ind}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Scalp / Intraday Outlook — hide for swing style */}
              {result.scalpOutlook && result.detectedStyle !== "swing" && (
                <div className={`rounded-lg border p-3 ${
                  result.detectedStyle === "scalping"
                    ? "border-red-500/20 bg-red-500/5"
                    : result.detectedStyle === "daytrading"
                      ? "border-blue-500/20 bg-blue-500/5"
                      : "border-blue-500/20 bg-blue-500/5"
                }`}>
                  <h4 className={`text-sm font-semibold mb-1 ${
                    result.detectedStyle === "scalping"
                      ? "text-red-600 dark:text-red-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`}>
                    {result.detectedStyle === "scalping" ? "📊 Scalp Outlook (1m / 5m)"
                      : result.detectedStyle === "daytrading" ? "📊 Intraday Setup (15m / 1H)"
                      : "📊 Scalp / Intraday Outlook"}
                  </h4>
                  <div className="text-sm text-foreground/80 leading-relaxed space-y-1">{renderMarkdown(result.scalpOutlook)}</div>
                </div>
              )}

              {/* Swing Outlook — hide for scalping style */}
              {result.swingOutlook && result.detectedStyle !== "scalping" && (
                <div className={`rounded-lg border p-3 ${
                  result.detectedStyle === "swing"
                    ? "border-amber-500/20 bg-amber-500/5"
                    : result.detectedStyle === "daytrading"
                      ? "border-blue-500/10 bg-blue-500/5"
                      : "border-blue-500/20 bg-blue-500/5"
                }`}>
                  <h4 className={`text-sm font-semibold mb-1 ${
                    result.detectedStyle === "swing"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`}>
                    {result.detectedStyle === "swing" ? "📈 Swing Outlook (4H / Daily)"
                      : result.detectedStyle === "daytrading" ? "📈 Short-Term Context (4H)"
                      : "📈 Swing / Position Outlook"}
                  </h4>
                  <div className="text-sm text-foreground/80 leading-relaxed space-y-1">{renderMarkdown(result.swingOutlook)}</div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-foreground/80 mb-2">Detailed Analysis</h4>
                <div className="text-sm text-foreground/80 leading-relaxed space-y-1">
                  {renderMarkdown(result.analysis)}
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic">{result.disclaimer}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
