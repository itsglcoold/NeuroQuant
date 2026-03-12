"use client";

import { useRouter } from "next/navigation";
import { Sidebar, MobileSidebar } from "@/components/dashboard/Sidebar";
import { DisclaimerGate } from "@/components/dashboard/DisclaimerGate";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BarChart3, Bell, User, Settings, CreditCard, LogOut } from "lucide-react";
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
                  <span className="text-sm font-semibold leading-none">NeuroQuant</span>
                  <span className="block text-[10px] text-muted-foreground leading-none mt-0.5">AI Market Research</span>
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
                    Upgrade Plan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => router.push("/auth/login")}
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
            {children}
          </main>
        </div>
      </div>
    </DisclaimerGate>
  );
}
