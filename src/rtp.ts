import type { BookRecord, LutRow } from "./types.ts";

export function equalWeights(books: BookRecord[]): LutRow[] {
  return books.map((b) => ({
    id: b.id,
    weight: 1,
    payoutMultiplier: b.payoutMultiplier,
  }));
}

export function empiricalRtp(rows: LutRow[], cost: number): number {
  let wp = 0;
  let w = 0;
  for (const row of rows) {
    wp += row.weight * row.payoutMultiplier;
    w += row.weight;
  }
  if (w <= 0 || cost <= 0) return 0;
  return wp / (w * cost);
}

export function maxWinObserved(books: BookRecord[]): number {
  return books.reduce((m, b) => Math.max(m, b.payoutMultiplier), 0);
}

function positiveInt(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.max(1, Math.round(n));
}

/**
 * Three buckets only: zero, small (1..ceiling), wincap.
 * Solve hit rate from RTP given mean small pay, then integer weights.
 * Wincap hit rate is tiny so 5000x does not blow up volatility.
 */
export function fitLowVolWeights(
  books: BookRecord[],
  cost: number,
  targetRtp: number,
  maxWin: number,
  wincapHitRate: number,
): LutRow[] {
  const zeros: number[] = [];
  const small: number[] = [];
  const caps: number[] = [];
  for (let i = 0; i < books.length; i++) {
    const p = books[i].payoutMultiplier;
    if (p >= maxWin) caps.push(i);
    else if (p === 0) zeros.push(i);
    else small.push(i);
  }

  const rows = equalWeights(books);
  if (small.length === 0 || targetRtp <= 0) return rows;

  const meanS =
    small.reduce((s, i) => s + books[i].payoutMultiplier, 0) / small.length;

  let q = wincapHitRate;
  if (caps.length === 0) q = 0;
  const wincapSlice = (q * maxWin) / cost;
  if (wincapSlice >= targetRtp * 0.2) {
    q = (targetRtp * 0.05 * cost) / maxWin;
  }

  let h: number;
  if (zeros.length === 0) {
    h = 1;
    if (meanS > targetRtp * cost && caps.length > 0) {
      q = (targetRtp * cost - meanS) / (maxWin - meanS);
      if (q < 0) q = 0;
    }
  } else {
    h = q + (targetRtp * cost - q * maxWin) / meanS;
    if (!Number.isFinite(h)) h = 0.3;
    h = Math.min(0.999, Math.max(q + 0.01, h));
  }

  const SCALE = 50_000_000;
  const wCapTotal = caps.length === 0 ? 0 : Math.max(1, Math.round(q * SCALE));
  const wSmallTotal = Math.max(small.length, Math.round((h - q) * SCALE));
  const wZeroTotal =
    zeros.length === 0 ? 0 : Math.max(zeros.length, Math.round((1 - h) * SCALE));

  const wS = positiveInt(wSmallTotal / small.length);
  const wZ = zeros.length === 0 ? 0 : positiveInt(wZeroTotal / zeros.length);
  const wC = caps.length === 0 ? 0 : positiveInt(wCapTotal / caps.length);

  for (const i of small) rows[i].weight = wS;
  for (const i of zeros) rows[i].weight = wZ;
  for (const i of caps) rows[i].weight = wC;

  return rows;
}

/** @deprecated absorber kept for tests; prefer fitLowVolWeights */
export function fitAbsorberWeights(
  books: BookRecord[],
  cost: number,
  targetRtp: number,
): LutRow[] {
  return fitLowVolWeights(
    books,
    cost,
    targetRtp,
    Math.max(1, ...books.map((b) => b.payoutMultiplier)),
    0,
  );
}
