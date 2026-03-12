import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl">
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

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {children}
      </div>

      {/* Footer with legal navigation */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} NeuroQuant. All rights
              reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/legal/terms"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms of Service
              </Link>
              <Link
                href="/legal/privacy"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy Policy
              </Link>
              <Link
                href="/legal/risk-disclosure"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Risk Disclosure
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
