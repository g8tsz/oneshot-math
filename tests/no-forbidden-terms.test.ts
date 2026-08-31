import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..");
const FORBIDDEN = [
  /slot[\s-]?engine/i,
  /@slot-engine/i,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "out" || name === ".git") {
      continue;
    }
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

test("repo text does not mention forbidden product names", () => {
  const files = walk(ROOT).filter((p) =>
    /\.(ts|md|json|sh|txt)$/i.test(p),
  );
  const hits: string[] = [];
  for (const file of files) {
    if (file.endsWith("no-forbidden-terms.test.ts")) continue;
    const text = readFileSync(file, "utf8");
    for (const re of FORBIDDEN) {
      if (re.test(text)) {
        hits.push(`${file} matches ${re}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});
