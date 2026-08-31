import type { BookEvent } from "./types.ts";

/**
 * Sole writer of book events. `index` is always the current array length.
 * Callers cannot supply, skip, duplicate, or reset indexes.
 */
export class EventLog {
  #events: BookEvent[] = [];

  get length(): number {
    return this.#events.length;
  }

  emit(type: string, fields: Record<string, unknown> = {}): BookEvent {
    if ("index" in fields) {
      throw new Error("EventLog.emit: do not pass index; it is assigned in order");
    }
    if ("type" in fields) {
      throw new Error("EventLog.emit: pass type as the first argument");
    }
    const event: BookEvent = { index: this.#events.length, type, ...fields };
    this.#events.push(event);
    return event;
  }

  snapshot(): BookEvent[] {
    for (let i = 0; i < this.#events.length; i++) {
      if (this.#events[i].index !== i) {
        throw new Error(
          `Event index drift at ${i}: got ${this.#events[i].index}`,
        );
      }
    }
    return this.#events.map((e) => ({ ...e }));
  }
}
