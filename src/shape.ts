import type { BookEvent, BookRecord, GameConfig, ModeConfig } from "./types.ts";

export function naturalCeiling(game: GameConfig, mode: ModeConfig): number {
  return Math.max(1, Math.round(game.naturalCeilingX * mode.cost));
}

function reindex(events: BookEvent[]): BookEvent[] {
  return events.map((e, i) => ({ ...e, index: i }));
}

function setAmount(events: BookEvent[], payout: number): BookEvent[] {
  return events.map((e) => {
    if (e.type === "finalWin" || e.type === "setTotalWin") {
      return { ...e, amount: payout };
    }
    return e;
  });
}

/**
 * Non-wincap books cannot pay above the natural ceiling.
 * The juiciest book is promoted to a true wincap (maxWin only).
 */
export function shapeLowVolatility(
  books: BookRecord[],
  game: GameConfig,
  mode: ModeConfig,
): BookRecord[] {
  if (books.length === 0) return books;
  const ceiling = naturalCeiling(game, mode);
  const ranked = [...books].sort(
    (a, b) => b.payoutMultiplier - a.payoutMultiplier || a.id - b.id,
  );
  const wincapId = ranked[0].id;

  let shaped = books.map((book) => {
    if (book.id === wincapId) {
      return toWincap(book, mode.maxWin);
    }
    const clipped = Math.min(book.payoutMultiplier, ceiling);
    return toNatural(book, clipped);
  });

  const zeros = shaped.filter((b) => b.payoutMultiplier === 0).length;
  if (zeros === 0) {
    shaped = scaleBodyToTarget(shaped, mode, ceiling);
  }
  return shaped;
}

/** When a mode has no zero books (buys), scale the small-pay body to target RTP. */
export function scaleBodyToTarget(
  books: BookRecord[],
  mode: ModeConfig,
  ceiling: number,
): BookRecord[] {
  const body = books.filter(
    (b) => b.payoutMultiplier > 0 && b.payoutMultiplier < mode.maxWin,
  );
  if (body.length === 0) return books;
  const mean = body.reduce((s, b) => s + b.payoutMultiplier, 0) / body.length;
  const targetMean = mode.rtp * mode.cost;
  if (mean <= 0 || targetMean <= 0) return books;
  const k = targetMean / mean;
  return books.map((book) => {
    if (book.payoutMultiplier >= mode.maxWin || book.payoutMultiplier === 0) {
      return book;
    }
    const payout = Math.min(ceiling, Math.max(1, Math.round(book.payoutMultiplier * k)));
    return toNatural(book, payout);
  });
}

function toNatural(book: BookRecord, payout: number): BookRecord {
  let events = book.events.filter((e) => e.type !== "wincap");
  events = setAmount(events, payout);
  events = reindex(events);
  let criteria = book.criteria;
  if (payout === 0) criteria = criteria === "freegame" ? "freegame" : "0";
  else if (criteria === "winCap") criteria = "basegame";
  return {
    ...book,
    payoutMultiplier: payout,
    events,
    criteria,
  };
}

function toWincap(book: BookRecord, maxWin: number): BookRecord {
  let events = book.events.filter((e) => e.type !== "wincap");
  events = setAmount(events, maxWin);
  const last = events[events.length - 1];
  const head = events.slice(0, -1);
  events = reindex([
    ...head,
    { index: 0, type: "wincap", amount: maxWin },
    last ?? { index: 0, type: "finalWin", amount: maxWin },
  ]);
  return {
    ...book,
    payoutMultiplier: maxWin,
    events,
    criteria: "winCap",
  };
}

export function countIllegalHighs(
  books: BookRecord[],
  ceiling: number,
  maxWin: number,
): number {
  return books.filter(
    (b) => b.payoutMultiplier > ceiling && b.payoutMultiplier < maxWin,
  ).length;
}
