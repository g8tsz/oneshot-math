import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BandRow, GameConfig, GenerateResult, LutRow, ModeResult } from "./types.ts";

function bandStats(
  name: string,
  minPayout: number,
  maxPayout: number,
  rows: LutRow[],
  cost: number,
  wSum: number,
): BandRow {
  const slice = rows.filter(
    (r) => r.payoutMultiplier >= minPayout && r.payoutMultiplier <= maxPayout,
  );
  const weight = slice.reduce((s, r) => s + r.weight, 0);
  const wp = slice.reduce((s, r) => s + r.weight * r.payoutMultiplier, 0);
  return {
    name,
    minPayout,
    maxPayout,
    books: slice.length,
    weight,
    hitRate: wSum > 0 ? weight / wSum : 0,
    rtp: wSum > 0 && cost > 0 ? wp / (wSum * cost) : 0,
  };
}

export function writeMathFile(
  outDir: string,
  game: GameConfig,
  result: GenerateResult,
  luts: Map<string, LutRow[]>,
): string {
  const library = join(outDir, "library");
  mkdirSync(library, { recursive: true });

  const modes = result.modes.map((mode) => {
    const lut = luts.get(mode.name) ?? [];
    const wSum = lut.reduce((s, r) => s + r.weight, 0);
    const ceiling = mode.naturalCeiling;
    return {
      name: mode.name,
      cost: mode.cost,
      bookCount: mode.bookCount,
      rtp: {
        target: mode.rtpTarget,
        rawEqualWeight: mode.rtpRaw,
        weighted: mode.rtpWeighted,
        delta: mode.rtpWeighted - mode.rtpTarget,
      },
      volatility: mode.volatility,
      naturalCeiling: ceiling,
      maxWin: mode.maxWinCap,
      illegalHighBooks: mode.illegalHighBooks,
      bands: [
        bandStats("zero", 0, 0, lut, mode.cost, wSum),
        bandStats("small", 1, ceiling, lut, mode.cost, wSum),
        bandStats("wincap", mode.maxWinCap, mode.maxWinCap, lut, mode.cost, wSum),
      ],
      rule: "Payouts strictly between naturalCeiling and maxWin are illegal. High multipliers exist only as wincap.",
    };
  });

  const body = {
    gameId: game.id,
    name: game.name,
    profile: "low-volatility",
    naturalCeilingX: game.naturalCeilingX,
    maxWinX: game.maxWinX,
    rtpTarget: game.rtp,
    whyLowVol:
      "Most RTP sits in frequent small wins at or below naturalCeilingX times stake. Wincap hit rate is tiny so q*(maxWin/cost)^2 stays inside a low-vol variance budget.",
    generatedAt: new Date().toISOString(),
    modes,
  };

  const mathPath = join(library, "math.json");
  writeFileSync(mathPath, `${JSON.stringify(body, null, 2)}\n`);
  writeFileSync(join(outDir, "math.json"), `${JSON.stringify(body, null, 2)}\n`);
  return mathPath;
}

export function writeMathConfig(outDir: string, game: GameConfig, modes: ModeResult[]): void {
  const dir = join(outDir, "library");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "config_math.json"),
    `${JSON.stringify(
      {
        gameId: game.id,
        name: game.name,
        maxWinX: game.maxWinX,
        rtp: game.rtp,
        naturalCeilingX: game.naturalCeilingX,
        modes: modes.map((m) => ({
          name: m.name,
          cost: m.cost,
          rtpTarget: m.rtpTarget,
          rtpWeighted: m.rtpWeighted,
          maxWin: m.maxWinCap,
          naturalCeiling: m.naturalCeiling,
          bookCount: m.bookCount,
          volatilityBand: m.volatility.band,
          cv: m.volatility.cv,
          hitRate: m.volatility.hitRate,
          wincapHitRate: m.volatility.wincapHitRate,
        })),
      },
      null,
      2,
    )}\n`,
  );
}
