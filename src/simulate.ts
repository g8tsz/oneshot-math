import { BookBuilder } from "./book.ts";
import { mulberry32 } from "./rng.ts";
import {
  anticipation,
  evaluateLines,
  forceScatterBoard,
  scatterPositions,
  spinBoard,
} from "./lines.ts";
import type { Board, GameConfig, ModeConfig } from "./types.ts";

function winLevel(amount: number, maxWin: number): number {
  if (amount <= 0) return 0;
  const t = amount / maxWin;
  if (t >= 1) return 9;
  if (t >= 0.5) return 6;
  if (t >= 0.2) return 4;
  if (t >= 0.05) return 2;
  return 1;
}

function playWindow(
  game: GameConfig,
  book: BookBuilder,
  board: Board,
  paddingPositions: number[],
  gameType: "basegame" | "freegame",
): { linePay: number; scatterPay: number; scatterCount: number } {
  book.events.emit("reveal", {
    board,
    paddingPositions,
    gameType,
    anticipation: anticipation(game, board),
  });

  const lineWins = evaluateLines(game, board);
  const scatters = scatterPositions(game, board);
  const scatterCount = scatters.length;
  const scatterPay = game.scatterPays[scatterCount] ?? 0;
  const linePay = lineWins.reduce((s, w) => s + w.win, 0);
  const windowPay = linePay + scatterPay;

  if (windowPay > 0) {
    book.events.emit("winInfo", {
      totalWin: windowPay,
      wins: lineWins.map((w) => ({
        symbol: w.symbol,
        kind: w.kind,
        win: w.win,
        positions: w.positions,
      })),
      scatter: scatterPay > 0 ? { count: scatterCount, win: scatterPay, positions: scatters } : undefined,
    });
    book.events.emit("setWin", {
      amount: windowPay,
      winLevel: winLevel(windowPay, game.maxWinX),
    });
  }

  return { linePay, scatterPay, scatterCount };
}

/**
 * One book, one seed. Seed equals book id so reruns are stable.
 * Event indexes never reset across free spins.
 */
export function simulateRound(
  game: GameConfig,
  mode: ModeConfig,
  bookId: number,
): BookBuilder {
  const rng = mulberry32(bookId * 1009 + mode.name.length * 9176);
  const book = new BookBuilder(bookId);
  const stripsBase = game.strips.base;
  const stripsFeature = game.strips.feature;

  const first =
    mode.kind === "bonus"
      ? forceScatterBoard(game, stripsBase, rng, 3)
      : spinBoard(game, stripsBase, rng);

  const baseWindow = playWindow(
    game,
    book,
    first.board,
    first.paddingPositions,
    "basegame",
  );

  let total = baseWindow.linePay + baseWindow.scatterPay;
  book.baseGameWins = total;
  book.events.emit("setTotalWin", { amount: total });

  let fsAwarded = game.scatterToFreespins[baseWindow.scatterCount] ?? 0;
  if (mode.kind === "bonus" && fsAwarded <= 0) {
    fsAwarded = game.scatterToFreespins[3] ?? 8;
  }

  if (fsAwarded > 0) {
    book.criteria = "freegame";
    book.events.emit("freeSpinTrigger", {
      totalFs: fsAwarded,
      positions: scatterPositions(game, first.board),
    });

    let remaining = fsAwarded;
    let totalFs = fsAwarded;
    let fsIndex = 0;
    let freePay = 0;

    while (remaining > 0 && fsIndex < game.maxFreespins) {
      fsIndex += 1;
      remaining -= 1;
      book.events.emit("updateFreeSpin", { amount: fsIndex, total: totalFs });

      const spin = spinBoard(game, stripsFeature, rng);
      const win = playWindow(
        game,
        book,
        spin.board,
        spin.paddingPositions,
        "freegame",
      );
      freePay += win.linePay + win.scatterPay;
      total = book.baseGameWins + freePay;
      book.events.emit("setTotalWin", { amount: total });

      const extra = game.scatterToFreespins[win.scatterCount] ?? 0;
      if (extra > 0 && totalFs < game.maxFreespins) {
        const add = Math.min(game.retriggerFreespins || extra, game.maxFreespins - totalFs);
        remaining += add;
        totalFs += add;
        book.events.emit("freeSpinTrigger", {
          totalFs,
          positions: scatterPositions(game, spin.board),
        });
      }
    }

    book.freeGameWins = freePay;
    book.events.emit("freeSpinEnd", {
      amount: freePay,
      winLevel: winLevel(freePay, game.maxWinX),
    });
  }

  let payout = total;
  let capped = false;
  if (payout > mode.maxWin) {
    payout = mode.maxWin;
    capped = true;
    book.criteria = "winCap";
  }
  if (capped) {
    book.events.emit("wincap", { amount: payout });
  }

  book.payoutMultiplier = payout;
  if (payout === 0) book.criteria = book.criteria === "freegame" ? "freegame" : "0";
  else if (book.criteria === "basegame" && book.freeGameWins === 0) book.criteria = "basegame";

  book.events.emit("finalWin", { amount: payout });
  return book;
}
