"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, MobileSidebar } from "@/components/dashboard/Sidebar";
import { DisclaimerGate } from "@/components/dashboard/DisclaimerGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BarChart3, Bell, User, Settings, CreditCard, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  // Client-side auth guard — needed because Cloudflare Pages serves
  // static pages directly via CDN, bypassing the middleware.
  useEffect(() => {
    const supabase = createClient();

    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/auth/login");
          return;
        }
      } catch {
        router.replace("/auth/login");
        return;
      }
      setAuthChecked(true);
    };
    checkAuth();

    // Listen for sign-out in other tabs — redirect immediately
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/auth/login");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <DisclaimerGate>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden">
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <MobileSidebar />
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="text-sm font-bold leading-none">NeuroQuant</span>
                  <span className="block text-[11px] text-muted-foreground/80 leading-none mt-0.5">AI Market Research</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                <span className="sr-only">Notifications</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 cursor-pointer hover:bg-accent transition-colors outline-none">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
                    <User className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Account
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                    <Settings className="h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/pricing")}>
                    <CreditCard className="h-4 w-4" />
                    Manage Plan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      localStorage.removeItem("nq_tier");
                      localStorage.removeItem("nq_usage");
                      router.replace("/");
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="min-h-0 flex-1 overflow-y-auto bg-background p-4 pb-12 lg:p-6 lg:pb-12">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </DisclaimerGate>
  );
}
