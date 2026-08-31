import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { demoLines } from "../games/demo-lines/game.ts";
import { EventLog } from "../src/events.ts";
import { BookBuilder } from "../src/book.ts";
import { generateGame, generateMode } from "../src/generate.ts";
import { simulateRound } from "../src/simulate.ts";
import { verifyPublishDir } from "../src/validate.ts";

test("EventLog assigns contiguous indexes and rejects caller index", () => {
  const log = new EventLog();
  log.emit("reveal", { board: [] });
  log.emit("setTotalWin", { amount: 0 });
  log.emit("finalWin", { amount: 0 });
  const events = log.snapshot();
  assert.deepEqual(
    events.map((e) => e.index),
    [0, 1, 2],
  );
  assert.throws(() => log.emit("reveal", { index: 0 }));
});

test("book ids cannot start at 0", () => {
  assert.throws(() => new BookBuilder(0));
  assert.doesNotThrow(() => new BookBuilder(1));
});

test("free spins do not reset event index", () => {
  const mode = demoLines.modes.find((m) => m.name === "bonus")!;
  const book = simulateRound(demoLines, mode, 1).toRecord();
  const indexes = book.events.map((e) => e.index);
  assert.equal(indexes[0], 0);
  for (let i = 0; i < indexes.length; i++) {
    assert.equal(indexes[i], i);
  }
  const reveals = book.events.filter((e) => e.type === "reveal");
  assert.ok(reveals.length >= 2, "bonus book should reveal more than once");
  assert.ok(reveals[1].index > reveals[0].index);
  assert.equal(book.events[book.events.length - 1].type, "finalWin");
});

test("each mode one-shot uses its own 1..N id space", () => {
  const base = generateMode(
    { ...demoLines, modes: demoLines.modes.map((m) => ({ ...m, bookCount: m.name === "base" ? 40 : m.bookCount })) },
    { ...demoLines.modes[0], bookCount: 40 },
  );
  const bonus = generateMode(
    demoLines,
    { ...demoLines.modes[1], bookCount: 20 },
  );
  assert.equal(base.books[0].id, 1);
  assert.equal(base.books[base.books.length - 1].id, 40);
  assert.equal(bonus.books[0].id, 1);
  assert.equal(bonus.books[bonus.books.length - 1].id, 20);
  assert.equal(new Set(base.books.map((b) => b.id)).size, 40);
});

test("generate all modes writes aligned publish files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "oneshot-math-"));
  const small = {
    ...demoLines,
    modes: demoLines.modes.map((m) => ({
      ...m,
      bookCount: m.name === "base" ? 60 : 24,
    })),
  };
  try {
    const result = await generateGame(small, { outDir: dir, modes: "all" });
    assert.equal(result.modes.length, 2);
    const issues = verifyPublishDir(result.publishDir);
    assert.deepEqual(issues, []);
    assert.ok(existsSync(join(dir, "math.json")));
    for (const mode of result.modes) {
      assert.ok(mode.rtpWeighted >= 0);
      assert.ok(mode.maxWinObserved <= mode.maxWinCap);
      assert.equal(mode.illegalHighBooks, 0);
      assert.equal(mode.maxWinBooks, 1);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
