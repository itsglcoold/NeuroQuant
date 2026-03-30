/**
 * Shared trade calculation logic.
 * Single source of truth for SL/TP — used by QuickSimWidget AND BulkTradeExecutor.
 * Changing numbers here changes both flows simultaneously.
 */

export const TRADE_STYLES = {
  safe:       { label: "Safe",       icon: "🛡️", atrMult: 1.5, rr: 2.0 },
  balanced:   { label: "Balanced",   icon: "⚖️", atrMult: 1.2, rr: 2.5 },
  aggressive: { label: "Aggressive", icon: "⚡", atrMult: 1.0, rr: 3.0 },
} as const;

export type TradeStyleKey = keyof typeof TRADE_STYLES;

/**
 * Compute SL/TP from ATR.
 * Mirrors QuickSimWidget handleStyleSelect (ATR branch) exactly:
 *   slDist = style.atrMult × atr
 *   tpDist = style.rr × slDist
 * No floor applied — same as the manual flow.
 */
export function computeSlTpFromATR(
  price: number,
  atr: number,
  style: TradeStyleKey,
  side: "long" | "short",
): { slPrice: number; tpPrice: number } {
  const s = TRADE_STYLES[style];
  const slDist = s.atrMult * atr;
  const tpDist = s.rr * slDist;
  return side === "long"
    ? { slPrice: price - slDist, tpPrice: price + tpDist }
    : { slPrice: price + slDist, tpPrice: price - tpDist };
}
