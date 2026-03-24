/**
 * Shared market hours utility.
 * Forex / metals / energy trade Sun 22:00 – Fri 22:00 UTC.
 * Compatible with both Edge Runtime and Node.js.
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  const d = now.getUTCDay();
  const h = now.getUTCHours();
  if (d === 6) return false;            // Saturday — always closed
  if (d === 0 && h < 22) return false;  // Sunday before 22:00 UTC
  if (d === 5 && h >= 22) return false; // Friday after 22:00 UTC
  return true;
}
