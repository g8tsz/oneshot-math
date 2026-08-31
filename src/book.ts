import { EventLog } from "./events.ts";
import type { BookRecord } from "./types.ts";

const MIN_BOOK_ID = 1;

export class BookBuilder {
  readonly id: number;
  readonly events = new EventLog();
  payoutMultiplier = 0;
  criteria = "basegame";
  baseGameWins = 0;
  freeGameWins = 0;

  constructor(id: number) {
    if (!Number.isInteger(id) || id < MIN_BOOK_ID) {
      throw new Error(`Book id must be an integer >= ${MIN_BOOK_ID}, got ${id}`);
    }
    this.id = id;
  }

  toRecord(): BookRecord {
    const events = this.events.snapshot();
    if (events.length === 0) {
      throw new Error(`Book ${this.id} has no events`);
    }
    if (events[0].type !== "reveal") {
      throw new Error(`Book ${this.id} must start with reveal`);
    }
    if (events[events.length - 1].type !== "finalWin") {
      throw new Error(`Book ${this.id} must end with finalWin`);
    }
    if (!Number.isInteger(this.payoutMultiplier) || this.payoutMultiplier < 0) {
      throw new Error(
        `Book ${this.id} payoutMultiplier must be a non-negative integer`,
      );
    }
    return {
      id: this.id,
      payoutMultiplier: this.payoutMultiplier,
      events,
      criteria: this.criteria,
      baseGameWins: this.baseGameWins,
      freeGameWins: this.freeGameWins,
    };
  }
}

export function assertModeIdSpace(books: BookRecord[]): void {
  if (books.length === 0) {
    throw new Error("Mode produced zero books");
  }
  for (let i = 0; i < books.length; i++) {
    const expected = i + 1;
    if (books[i].id !== expected) {
      throw new Error(
        `Mode ID space broken: book[${i}] id=${books[i].id}, expected ${expected}`,
      );
    }
  }
}
