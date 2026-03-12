import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroQuant — AI Market Research",
  description:
    "AI-powered market research platform. Triple-AI consensus engine delivers educational insights for Gold, Silver, Oil, Forex, and major indices.",
  keywords: [
    "AI",
    "market analysis",
    "trading",
    "forex",
    "gold",
    "silver",
    "oil",
    "S&P 500",
    "NASDAQ",
    "AI trading",
    "technical analysis",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
