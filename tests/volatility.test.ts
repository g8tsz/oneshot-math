import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { demoLines } from "../games/demo-lines/game.ts";
import { generateGame, generateMode } from "../src/generate.ts";
import { naturalCeiling } from "../src/shape.ts";
import { verifyPublishDir } from "../src/validate.ts";

test("non-wincap books cannot sit between ceiling and maxWin", () => {
  const mode = { ...demoLines.modes[0], bookCount: 80 };
  const shot = generateMode(demoLines, mode);
  const ceiling = naturalCeiling(demoLines, mode);
  assert.equal(shot.stats.illegalHighBooks, 0);
  assert.equal(shot.stats.maxWinBooks, 1);
  for (const book of shot.books) {
    const p = book.payoutMultiplier;
    if (p === mode.maxWin) {
      assert.equal(book.criteria, "winCap");
      assert.ok(book.events.some((e) => e.type === "wincap"));
      continue;
    }
    assert.ok(p <= ceiling, `id ${book.id} payout ${p} > ceiling ${ceiling}`);
  }
});

test("math.json is written per game with volatility and bands", async () => {
  const dir = mkdtempSync(join(tmpdir(), "oneshot-math-"));
  const small = {
    ...demoLines,
    modes: demoLines.modes.map((m) => ({
      ...m,
      bookCount: m.name === "base" ? 80 : 24,
    })),
  };
  try {
    const result = await generateGame(small, { outDir: dir, modes: "all" });
    assert.equal(verifyPublishDir(result.publishDir).length, 0);
    assert.ok(existsSync(join(dir, "math.json")));
    assert.ok(existsSync(join(dir, "library", "math.json")));
    const math = JSON.parse(readFileSync(join(dir, "math.json"), "utf8")) as {
      profile: string;
      naturalCeilingX: number;
      modes: Array<{
        name: string;
        illegalHighBooks: number;
        volatility: { band: string; wincapHitRate: number };
        bands: Array<{ name: string; books: number }>;
      }>;
    };
    assert.equal(math.profile, "low-volatility");
    assert.equal(math.naturalCeilingX, 12);
    for (const mode of math.modes) {
      assert.equal(mode.illegalHighBooks, 0);
      assert.ok(mode.volatility.wincapHitRate < 0.01);
      const high = mode.bands.find((b) => b.name === "wincap");
      assert.equal(high?.books, 1);
    }
    for (const mode of result.modes) {
      assert.ok(mode.volatility.stdev >= 0);
      assert.ok(["low", "medium", "high"].includes(mode.volatility.band));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
