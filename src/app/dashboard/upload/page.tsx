"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Image as ImageIcon, TrendingUp, TrendingDown, Minus, Lock } from "lucide-react";
import { ChartAnalysisResult } from "@/types/analysis";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import Link from "next/link";

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
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
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
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-blue-500/50 transition-colors"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-1">Drop your chart here</p>
              <p className="text-sm text-muted-foreground">or click to browse (PNG, JPG, WebP up to 5MB)</p>
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
              <div className="flex flex-wrap gap-2">
                <Badge className={directionColor[result.direction]}>
                  {result.direction.toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  Confidence: {result.confidence}/10
                </Badge>
                {result.detectedSymbol && (
                  <Badge variant="secondary">{result.detectedSymbol}</Badge>
                )}
                {result.detectedTimeframe && (
                  <Badge variant="secondary">{result.detectedTimeframe}</Badge>
                )}
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
                  <div>
                    <h4 className="text-sm font-semibold text-green-600 dark:text-green-500 mb-1">Support</h4>
                    {result.supportLevels.map((level, i) => (
                      <p key={i} className="text-sm text-muted-foreground">${level}</p>
                    ))}
                  </div>
                )}
                {result.resistanceLevels.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-600 dark:text-red-500 mb-1">Resistance</h4>
                    {result.resistanceLevels.map((level, i) => (
                      <p key={i} className="text-sm text-muted-foreground">${level}</p>
                    ))}
                  </div>
                )}
              </div>

              {result.indicators.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground/80 mb-2">Indicator Readings</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {result.indicators.map((ind, i) => (
                      <li key={i}>- {ind}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-foreground/80 mb-2">Detailed Analysis</h4>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{result.analysis}</p>
              </div>

              <p className="text-xs text-muted-foreground italic">{result.disclaimer}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
