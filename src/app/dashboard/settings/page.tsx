"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, CreditCard, Shield, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<string>("free");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? null);
        // Try to get tier from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single();
        if (profile?.subscription_tier) {
          setTier(profile.subscription_tier);
        }
      }
    }
    load();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem("nq_tier");
    localStorage.removeItem("nq_usage");
    router.push("/");
    router.refresh();
  }

  const tierLabel = tier === "premium" ? "Premium" : tier === "pro" ? "Pro" : "Free";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <p className="font-medium">{email ?? "Loading..."}</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {signingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{tierLabel}</p>
                <Badge className="bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20">Active</Badge>
              </div>
            </div>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Subscription management will be available when public access is enabled.
          </p>
        </CardContent>
      </Card>

      {/* Legal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Legal & Disclaimers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All analyses provided by this platform are for educational and informational
            purposes only. They do not constitute investment advice, financial advice,
            trading advice, or any other sort of advice. You should not treat any of
            the content as such. Do your own due diligence and consult your financial
            advisor before making any investment decisions.
          </p>
          <Separator />
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href="/legal/terms"
              className="inline-flex items-center gap-1 text-sm text-blue-400 transition-colors hover:text-blue-300"
            >
              Terms of Service
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/legal/privacy"
              className="inline-flex items-center gap-1 text-sm text-blue-400 transition-colors hover:text-blue-300"
            >
              Privacy Policy
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/legal/risk-disclosure"
              className="inline-flex items-center gap-1 text-sm text-blue-400 transition-colors hover:text-blue-300"
            >
              Risk Disclosure
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Contact: <a href="mailto:legal@neuroquant.app" className="underline hover:text-muted-foreground transition-colors">legal@neuroquant.app</a> · <a href="mailto:privacy@neuroquant.app" className="underline hover:text-muted-foreground transition-colors">privacy@neuroquant.app</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
