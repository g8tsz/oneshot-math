import type { BookRecord, LutRow, VolatilityBand, VolatilityStats } from "./types.ts";
import { empiricalRtp } from "./rtp.ts";

export function classifyCv(cv: number): VolatilityBand {
  if (cv < 2.5) return "low";
  if (cv < 5) return "medium";
  return "high";
}

/**
 * Volatility of X = payout / cost on the weighted LUT.
 * Wincap at 5000x would dominate stdev unless its hit rate is tiny:
 * q must satisfy q * (maxWin/cost)^2 << body variance.
 */
export function measureVolatility(
  rows: LutRow[],
  cost: number,
  maxWin: number,
): VolatilityStats {
  let wSum = 0;
  let hitW = 0;
  let capW = 0;
  for (const row of rows) {
    wSum += row.weight;
    if (row.payoutMultiplier > 0) hitW += row.weight;
    if (row.payoutMultiplier >= maxWin) capW += row.weight;
  }
  if (wSum <= 0) {
    return {
      mean: 0,
      stdev: 0,
      cv: 0,
      band: "low",
      hitRate: 0,
      wincapHitRate: 0,
      definition: "stdev of payout/cost on weighted books",
    };
  }

  const mean = empiricalRtp(rows, cost);
  let second = 0;
  for (const row of rows) {
    const x = row.payoutMultiplier / cost;
    const p = row.weight / wSum;
    second += p * x * x;
  }
  const variance = Math.max(0, second - mean * mean);
  const stdev = Math.sqrt(variance);
  const cv = mean > 0 ? stdev / mean : 0;
  return {
    mean,
    stdev,
    cv,
    band: classifyCv(cv),
    hitRate: hitW / wSum,
    wincapHitRate: capW / wSum,
    definition: "stdev of payout/cost on weighted books; CV = stdev/mean",
  };
}

export function wincapHitRateForLowVol(
  cost: number,
  maxWin: number,
  requested?: number,
): number {
  const x = maxWin / cost;
  const tailVarBudget = 0.45;
  const qVar = tailVarBudget / (x * x);
  const qRtp = (0.02 * 0.96 * cost) / maxWin;
  const q = Math.min(requested ?? qVar, qVar, qRtp);
  return Math.max(q, 1 / 1_000_000_000);
}

export function illegalHighCount(
  books: BookRecord[],
  ceiling: number,
  maxWin: number,
): number {
  return books.filter(
    (b) => b.payoutMultiplier > ceiling && b.payoutMultiplier < maxWin,
  ).length;
}
