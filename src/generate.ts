import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertModeIdSpace } from "./book.ts";
import { writeMathConfig, writeMathFile } from "./mathfile.ts";
import { writeIndex, writeModeFiles } from "./package.ts";
import { empiricalRtp, fitLowVolWeights, maxWinObserved } from "./rtp.ts";
import { countIllegalHighs, naturalCeiling, shapeLowVolatility } from "./shape.ts";
import { simulateRound } from "./simulate.ts";
import type {
  BookRecord,
  GameConfig,
  GenerateOptions,
  GenerateResult,
  LutRow,
  ModeConfig,
  ModeResult,
} from "./types.ts";
import { assertVerified } from "./validate.ts";
import { measureVolatility, wincapHitRateForLowVol } from "./volatility.ts";

function selectModes(game: GameConfig, selector: string): ModeConfig[] {
  if (selector === "all") return game.modes;
  const found = game.modes.filter((m) => m.name === selector);
  if (found.length === 0) {
    throw new Error(
      `Unknown mode "${selector}". Have: ${game.modes.map((m) => m.name).join(", ")}`,
    );
  }
  return found;
}

export type ModeShot = {
  books: BookRecord[];
  lut: LutRow[];
  stats: ModeResult;
};

/**
 * Generate one mode in isolation. Book IDs are always 1..N for that mode.
 * Shape: small pays only, high multipliers exclusively on wincap.
 */
export function generateMode(game: GameConfig, mode: ModeConfig): ModeShot {
  const raw: BookRecord[] = [];
  for (let id = 1; id <= mode.bookCount; id++) {
    raw.push(simulateRound(game, mode, id).toRecord());
  }
  const books = shapeLowVolatility(raw, game, mode);
  assertModeIdSpace(books);

  const ceiling = naturalCeiling(game, mode);
  const q = wincapHitRateForLowVol(mode.cost, mode.maxWin, game.wincapHitRate);
  const lut = fitLowVolWeights(books, mode.cost, mode.rtp, mode.maxWin, q);
  const vol = measureVolatility(lut, mode.cost, mode.maxWin);

  const stats: ModeResult = {
    name: mode.name,
    cost: mode.cost,
    bookCount: books.length,
    rtpRaw: empiricalRtp(
      books.map((b) => ({
        id: b.id,
        weight: 1,
        payoutMultiplier: b.payoutMultiplier,
      })),
      mode.cost,
    ),
    rtpWeighted: empiricalRtp(lut, mode.cost),
    rtpTarget: mode.rtp,
    maxWinObserved: maxWinObserved(books),
    maxWinCap: mode.maxWin,
    naturalCeiling: ceiling,
    zeroBooks: books.filter((b) => b.payoutMultiplier === 0).length,
    maxWinBooks: books.filter((b) => b.payoutMultiplier >= mode.maxWin).length,
    illegalHighBooks: countIllegalHighs(books, ceiling, mode.maxWin),
    volatility: vol,
  };
  return { books, lut, stats };
}

export async function generateGame(
  game: GameConfig,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const modes = selectModes(game, options.modes);
  mkdirSync(options.outDir, { recursive: true });
  const indexEntries = [];
  const results: ModeResult[] = [];
  const luts = new Map<string, LutRow[]>();

  for (const mode of modes) {
    const shot = generateMode(game, mode);
    const files = writeModeFiles({
      outDir: options.outDir,
      mode,
      books: shot.books,
      lut: shot.lut,
    });
    indexEntries.push({ mode, ...files });
    results.push(shot.stats);
    luts.set(mode.name, shot.lut);
    writeFileSync(
      join(options.outDir, `run_${mode.name}.json`),
      `${JSON.stringify({ mode: mode.name, ...shot.stats, generatedAt: new Date().toISOString() }, null, 2)}\n`,
    );
  }

  writeIndex(options.outDir, indexEntries);
  writeMathConfig(options.outDir, game, results);
  const partial: GenerateResult = {
    gameId: game.id,
    publishDir: join(options.outDir, "publish_files"),
    mathFile: "",
    modes: results,
  };
  const mathFile = writeMathFile(options.outDir, game, partial, luts);
  assertVerified(join(options.outDir, "publish_files"));

  return { ...partial, mathFile };
}
