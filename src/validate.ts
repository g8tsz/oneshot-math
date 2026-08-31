import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
import type { BookRecord } from "./types.ts";

export type VerifyIssue = { level: "blocker" | "warn"; message: string };

type IndexFile = {
  modes: Array<{ name: string; cost: number; events: string; weights: string }>;
};

function parseJsonl(text: string): BookRecord[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      const row = JSON.parse(line) as BookRecord;
      if (typeof row.id !== "number") {
        throw new Error(`jsonl line ${i + 1}: missing id`);
      }
      return row;
    });
}

function parseLut(text: string): Array<{ id: number; weight: number; payout: number }> {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      const [id, weight, payout] = line.split(",").map((x) => Number(x.trim()));
      if (![id, weight, payout].every((n) => Number.isFinite(n))) {
        throw new Error(`lut line ${i + 1}: expected id,weight,payout`);
      }
      return { id, weight, payout };
    });
}

export function verifyPublishDir(publishDir: string): VerifyIssue[] {
  const issues: VerifyIssue[] = [];
  const indexPath = join(publishDir, "index.json");
  if (!existsSync(indexPath)) {
    return [{ level: "blocker", message: `missing ${indexPath}` }];
  }
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as IndexFile;
  if (!Array.isArray(index.modes) || index.modes.length === 0) {
    issues.push({ level: "blocker", message: "index.json has no modes" });
    return issues;
  }

  for (const mode of index.modes) {
    const bookPath = join(publishDir, mode.events);
    const lutPath = join(publishDir, mode.weights);
    if (!existsSync(bookPath)) {
      issues.push({ level: "blocker", message: `missing events ${mode.events}` });
      continue;
    }
    if (!existsSync(lutPath)) {
      issues.push({ level: "blocker", message: `missing weights ${mode.weights}` });
      continue;
    }

    const raw = readFileSync(bookPath);
    const jsonl = zstdDecompressSync(raw).toString("utf8");
    let books: BookRecord[];
    try {
      books = parseJsonl(jsonl);
    } catch (err) {
      issues.push({ level: "blocker", message: `${mode.name}: ${String(err)}` });
      continue;
    }
    const lut = parseLut(readFileSync(lutPath, "utf8"));

    if (books.length !== lut.length) {
      issues.push({
        level: "blocker",
        message: `${mode.name}: book count ${books.length} != lut count ${lut.length}`,
      });
    }

    const seen = new Set<number>();
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      const expectedId = i + 1;
      if (book.id !== expectedId) {
        issues.push({
          level: "blocker",
          message: `${mode.name}: book[${i}] id=${book.id}, expected ${expectedId} (one-shot ID space)`,
        });
      }
      if (book.id < 1) {
        issues.push({
          level: "blocker",
          message: `${mode.name}: book id ${book.id} is not allowed (min 1)`,
        });
      }
      if (seen.has(book.id)) {
        issues.push({
          level: "blocker",
          message: `${mode.name}: duplicate book id ${book.id}`,
        });
      }
      seen.add(book.id);

      if (!Array.isArray(book.events) || book.events.length === 0) {
        issues.push({ level: "blocker", message: `${mode.name} id ${book.id}: empty events` });
        continue;
      }
      for (let e = 0; e < book.events.length; e++) {
        if (book.events[e].index !== e) {
          issues.push({
            level: "blocker",
            message: `${mode.name} id ${book.id}: event index ${book.events[e].index} at position ${e}`,
          });
        }
      }
      if (book.events[0].type !== "reveal") {
        issues.push({
          level: "blocker",
          message: `${mode.name} id ${book.id}: first event is ${book.events[0].type}, not reveal`,
        });
      }
      if (book.events[book.events.length - 1].type !== "finalWin") {
        issues.push({
          level: "blocker",
          message: `${mode.name} id ${book.id}: last event is not finalWin`,
        });
      }
      if (book.payoutMultiplier !== lut[i]?.payout) {
        issues.push({
          level: "blocker",
          message: `${mode.name} id ${book.id}: book payout ${book.payoutMultiplier} != lut ${lut[i]?.payout}`,
        });
      }
      if (lut[i]?.id !== book.id) {
        issues.push({
          level: "blocker",
          message: `${mode.name} id ${book.id}: lut id ${lut[i]?.id} mismatch`,
        });
      }
      if (!lut[i] || lut[i].weight <= 0 || !Number.isInteger(lut[i].weight)) {
        issues.push({
          level: "blocker",
          message: `${mode.name} id ${book.id}: weight must be a positive integer`,
        });
      }
    }

    const maxWin = Math.max(...books.map((b) => b.payoutMultiplier));
    const capBooks = books.filter((b) => b.criteria === "winCap" || b.payoutMultiplier >= maxWin);
    if (capBooks.length > 0) {
      const ceiling = Math.max(
        ...books
          .filter((b) => b.payoutMultiplier < maxWin)
          .map((b) => b.payoutMultiplier),
        0,
      );
      for (const book of books) {
        if (book.payoutMultiplier > ceiling && book.payoutMultiplier < maxWin) {
          issues.push({
            level: "blocker",
            message: `${mode.name} id ${book.id}: payout ${book.payoutMultiplier} is a high multi between ceiling ${ceiling} and wincap ${maxWin}`,
          });
        }
      }
    }
  }

  return issues;
}

export function assertVerified(publishDir: string): void {
  const issues = verifyPublishDir(publishDir);
  const blockers = issues.filter((i) => i.level === "blocker");
  if (blockers.length > 0) {
    throw new Error(blockers.map((b) => b.message).join("\n"));
  }
}
