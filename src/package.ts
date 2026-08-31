import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { zstdCompressSync } from "node:zlib";
import type { BookRecord, LutRow, ModeConfig } from "./types.ts";

export function booksJsonl(books: BookRecord[]): string {
  return books.map((b) => JSON.stringify(b)).join("\n") + "\n";
}

export function lutCsv(rows: LutRow[]): string {
  return rows.map((r) => `${r.id},${r.weight},${r.payoutMultiplier}`).join("\n") + "\n";
}

export function criteriaCsv(books: BookRecord[]): string {
  return books.map((b) => `${b.id},${b.criteria}`).join("\n") + "\n";
}

export function indexJson(
  modes: Array<{ mode: ModeConfig; eventsFile: string; weightsFile: string }>,
): string {
  return `${JSON.stringify(
    {
      modes: modes.map((m) => ({
        name: m.mode.name,
        cost: m.mode.cost,
        events: m.eventsFile,
        weights: m.weightsFile,
      })),
    },
    null,
    2,
  )}\n`;
}

export function writeModeFiles(opts: {
  outDir: string;
  mode: ModeConfig;
  books: BookRecord[];
  lut: LutRow[];
}): { eventsFile: string; weightsFile: string } {
  const publishDir = join(opts.outDir, "publish_files");
  const booksDir = join(opts.outDir, "library", "books");
  const lutDir = join(opts.outDir, "library", "lookup_tables");
  mkdirSync(publishDir, { recursive: true });
  mkdirSync(booksDir, { recursive: true });
  mkdirSync(lutDir, { recursive: true });

  const eventsName = `books_${opts.mode.name}.jsonl.zst`;
  const weightsName = `lookUpTable_${opts.mode.name}_0.csv`;
  const jsonl = booksJsonl(opts.books);
  const csv = lutCsv(opts.lut);

  writeFileSync(join(booksDir, `books_${opts.mode.name}.jsonl`), jsonl);
  writeFileSync(join(lutDir, weightsName), csv);
  writeFileSync(join(lutDir, `lookUpTableIdToCriteria_${opts.mode.name}.csv`), criteriaCsv(opts.books));

  const compressed = zstdCompressSync(Buffer.from(jsonl, "utf8"));
  writeFileSync(join(publishDir, eventsName), compressed);
  writeFileSync(join(publishDir, weightsName), csv);

  return { eventsFile: eventsName, weightsFile: weightsName };
}

export function writeIndex(
  outDir: string,
  entries: Array<{ mode: ModeConfig; eventsFile: string; weightsFile: string }>,
): void {
  const publishDir = join(outDir, "publish_files");
  mkdirSync(publishDir, { recursive: true });
  writeFileSync(join(publishDir, "index.json"), indexJson(entries));
}
