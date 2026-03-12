import Link from "next/link";
import { BarChart3, ArrowLeft } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              NeuroQuant
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {children}
      </div>

      {/* Footer with legal navigation */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-xs text-zinc-600">
              &copy; {new Date().getFullYear()} NeuroQuant. All rights
              reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/legal/terms"
                className="text-xs text-zinc-500 transition-colors hover:text-white"
              >
                Terms of Service
              </Link>
              <Link
                href="/legal/privacy"
                className="text-xs text-zinc-500 transition-colors hover:text-white"
              >
                Privacy Policy
              </Link>
              <Link
                href="/legal/risk-disclosure"
                className="text-xs text-zinc-500 transition-colors hover:text-white"
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
