"use client";

import Link from "next/link";
import { Lock, Zap, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserTier } from "@/hooks/useUsageTracking";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  requiredTier: UserTier;
  reason?: "limit-reached" | "feature-locked";
}

const TIER_INFO: Record<UserTier, { label: string; price: string; icon: typeof Zap; color: string }> = {
  free: { label: "Free", price: "$0", icon: Lock, color: "text-muted-foreground" },
  pro: { label: "Pro", price: "$19.99/mo", icon: Zap, color: "text-blue-500" },
  premium: { label: "Premium", price: "$49.99/mo", icon: Crown, color: "text-amber-500" },
};

const FEATURE_NAMES: Record<string, string> = {
  "ai-analysis": "AI Analysis",
  "chart-upload": "Chart Upload & Pattern Recognition",
  "ai-chat": "AI Chat",
  "triple-ai": "Triple-AI Consensus",
  "custom-alerts": "Custom Alerts & Notifications",
  "ai-suggestions": "AI Market Suggestions",
  "historical-reports": "Historical Analysis Reports",
  "api-access": "API Access",
};

export function UpgradeModal({ open, onClose, feature, requiredTier, reason = "feature-locked" }: UpgradeModalProps) {
  const tierInfo = TIER_INFO[requiredTier];
  const featureName = FEATURE_NAMES[feature] || feature;
  const TierIcon = tierInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
            <Lock className="h-7 w-7 text-blue-500" />
          </div>
          <DialogTitle className="text-center text-lg">
            {reason === "limit-reached"
              ? "Daily limit reached"
              : `${tierInfo.label} Feature`}
          </DialogTitle>
          <DialogDescription className="text-center">
            {reason === "limit-reached" ? (
              <>
                You&apos;ve used all your free AI analyses for today.
                Upgrade to <span className={`font-semibold ${tierInfo.color}`}>{tierInfo.label}</span> for
                {requiredTier === "pro" ? " 50 analyses per day" : " unlimited analyses"}.
              </>
            ) : (
              <>
                <span className="font-semibold text-foreground">{featureName}</span> requires a{" "}
                <span className={`font-semibold ${tierInfo.color}`}>{tierInfo.label}</span> plan ({tierInfo.price}).
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-lg border border-border bg-secondary/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TierIcon className={`h-4 w-4 ${tierInfo.color}`} />
            <span className={`text-sm font-semibold ${tierInfo.color}`}>{tierInfo.label} includes:</span>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {requiredTier === "pro" ? (
              <>
                <li>• 50 AI analyses per day</li>
                <li>• All 25+ markets</li>
                <li>• Triple-AI consensus engine</li>
                <li>• Chart upload & pattern recognition</li>
                <li>• All technical indicators</li>
                <li>• AI Market Suggestions (3 markets)</li>
              </>
            ) : (
              <>
                <li>• Unlimited AI analyses</li>
                <li>• Everything in Pro</li>
                <li>• AI Chat for market Q&A</li>
                <li>• Historical analysis reports</li>
                <li>• API access for your own tools</li>
                <li>• AI Market Suggestions (5 markets)</li>
              </>
            )}
          </ul>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Link href="/pricing" onClick={onClose}>
            <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/25">
              View Plans & Upgrade
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
