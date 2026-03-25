/**
 * Professional risk metrics for the analytics dashboard.
 * Based on institutional trading standards.
 */

export interface TradeMetric {
  pnlPercent: number;
}

// ---------------------------------------------------------------------------
// Profit Factor
// PF = gross profit / gross loss. >1.3 = good, >1.5 = strong
// ---------------------------------------------------------------------------
export function calcProfitFactor(trades: TradeMetric[]): number {
  const gross = trades.reduce(
    (acc, t) => {
      if (t.pnlPercent > 0) acc.profit += t.pnlPercent;
      else acc.loss += Math.abs(t.pnlPercent);
      return acc;
    },
    { profit: 0, loss: 0 }
  );
  if (gross.loss === 0) return gross.profit > 0 ? 99 : 0;
  return Math.round((gross.profit / gross.loss) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Expectancy per trade (Van Tharp formula)
// E = (win% × avgWin) - (loss% × avgLoss)
// Positive = edge exists. >0.3 = decent, >0.5 = strong system.
// ---------------------------------------------------------------------------
export interface ExpectancyResult {
  value: number;
  avgWin: number;
  avgLoss: number;
  breakevenWinRate: number; // minimum win% needed to break even at current avg RR
}

export function calcExpectancy(trades: TradeMetric[]): ExpectancyResult {
  if (trades.length === 0) {
    return { value: 0, avgWin: 0, avgLoss: 0, breakevenWinRate: 0 };
  }

  const wins = trades.filter((t) => t.pnlPercent > 0);
  const losses = trades.filter((t) => t.pnlPercent < 0);

  const avgWin =
    wins.length > 0
      ? wins.reduce((s, t) => s + t.pnlPercent, 0) / wins.length
      : 0;
  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length)
      : 0;

  const winRate = wins.length / trades.length;
  const lossRate = 1 - winRate;

  const value =
    Math.round((winRate * avgWin - lossRate * avgLoss) * 100) / 100;

  // Breakeven win rate = avgLoss / (avgWin + avgLoss)
  const breakevenWinRate =
    avgWin + avgLoss > 0
      ? Math.round((avgLoss / (avgWin + avgLoss)) * 100)
      : 50;

  return {
    value,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    breakevenWinRate,
  };
}

// ---------------------------------------------------------------------------
// Max Drawdown from closed-trade equity curve
// ---------------------------------------------------------------------------
export function calcMaxDrawdown(trades: TradeMetric[]): number {
  if (trades.length === 0) return 0;
  let peak = 0;
  let cum = 0;
  let maxDD = 0;
  for (const t of trades) {
    cum += t.pnlPercent;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }
  return Math.round(maxDD * 100) / 100;
}

// ---------------------------------------------------------------------------
// Sharpe Ratio (simplified, not annualized — per-trade basis)
// Sharpe >1 is good for a trading system
// ---------------------------------------------------------------------------
export function calcSharpeRatio(trades: TradeMetric[]): number {
  if (trades.length < 2) return 0;
  const returns = trades.map((t) => t.pnlPercent);
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + Math.pow(r - avg, 2), 0) /
    (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return Math.round((avg / stdDev) * 100) / 100;
}
