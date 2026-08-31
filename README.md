# oneshot-math

One-shot math generator for Stake RGS publish files.

Each bet mode is generated in a **single isolated pass**: sequential book IDs starting at `1`, sequential event indexes starting at `0` for the whole round, lookup table aligned to those IDs, RTP from the weighted table, max-win cap applied before `finalWin`.

Do not stitch modes together, do not resume IDs from another mode, and do not reset event indexes when a feature starts.

## Why event IDs break

The RGS returns `book.events` from `/play`. The frontend replays that array in order. Two ID spaces exist and they are not interchangeable:

| ID | Where | Rule |
| --- | --- | --- |
| Book `id` | `books_<mode>.jsonl` line + LUT column 0 | Integer, unique per mode, starts at **1**, contiguous `1..N` |
| Event `index` | each object in `events` | Integer, unique per book, starts at **0**, equal to array position |

Common failures this generator refuses:

- Book IDs starting at `0`
- Event `index` reset to `0` on freespin or tumble (must continue)
- Lookup row `id` that does not exist in the book file
- `payoutMultiplier` in the book not matching LUT column 2
- Generating `base` and `bonus` in one mixed ID stream

## One shot per mode

```
npx tsx src/cli.ts generate --game games/demo-lines --out out/demo-lines --mode base
npx tsx src/cli.ts generate --game games/demo-lines --out out/demo-lines --mode bonus
npx tsx src/cli.ts verify --dir out/demo-lines/publish_files
```

`--mode all` runs each mode as its own shot (IDs restart at 1 inside every mode), then writes one `index.json`.

Requires **Node >= 22.15** (native zstd).

```bash
npm install
npm test
npm run generate
npm run verify
```

## Publish files

Written to `<out>/publish_files/` in the format the RGS upload expects ([required math files](https://stakeengine.github.io/math-sdk/rgs_docs/data_format/)):

- `index.json` — mode name, cost, events filename, weights filename
- `books_<mode>.jsonl.zst` — one JSON object per round: `id`, `events`, `payoutMultiplier`
- `lookUpTable_<mode>_0.csv` — `id,weight,payoutMultiplier` as unsigned integers

Uncompressed books for debugging: `<out>/library/books/books_<mode>.jsonl`.

`payoutMultiplier` is an integer in bet units (example: `1150` is 11.50x when you treat the unit as 0.01x, or `20` is 20x when you treat the unit as 1x). This demo uses **1x units** (integer multipliers).

## Event contract

`EventLog.emit` is the only way to append an event. Callers cannot pass `index`. Indexes are `0..n-1` with no gaps. A book that skips, duplicates, or resets fails validation and is not written.

Typical lines round:

1. `reveal`
2. `winInfo` / `setWin` / `setTotalWin` when there is a line or scatter pay
3. `freeSpinTrigger` then `updateFreeSpin` + `reveal` … for each free spin (indexes keep climbing)
4. `freeSpinEnd`
5. `wincap` if the round hit `maxWin`
6. `finalWin` (always last)

## RTP, volatility, and max-win

The generator does not leave a fat tail of 50x–2000x sitting under the cap. After each mode is simulated it **shapes** the books:

1. **Natural ceiling** = `naturalCeilingX * mode.cost` (demo: **12x** stake). Every non-wincap book is clipped here.
2. **One wincap book** per mode is set to `maxWin` (demo: **5000x**) and emits `wincap`. That is the only high multi.
3. **Weights** put RTP in frequent small wins. Wincap hit rate is forced tiny so `q * (maxWin/cost)^2` does not explode variance. A 5000x at even 1-in-10k is high-vol; low-vol needs ~1-in-tens-of-millions, which integer LUT weights can represent.

Volatility is the stdev of `payout / cost` on the weighted LUT, with `CV = stdev / mean`. Band: low `< 2.5`, medium `< 5`, else high.

Each run writes a per-game math file:

- `math.json` (and `library/math.json`) — RTP, CV, hit rate, wincap hit rate, zero / small / wincap bands
- `library/config_math.json` — short mode table for the same numbers

Weighted RTP:

`sum(weight * payout) / (sum(weight) * cost)`

## Library

```ts
import { generateGame, verifyPublishDir } from "./src/index.ts";
import { demoLines } from "./games/demo-lines/game.ts";

const result = await generateGame(demoLines, {
  outDir: "out/demo-lines",
  modes: "all",
});
verifyPublishDir("out/demo-lines/publish_files");
```

## Demo game

`games/demo-lines` — 5x3, 20 lines, wild, scatter free spins, `base` (1x) and `bonus` (100x buy). Targets are in the game file. Demo book counts are small so the pipeline is testable; raise `bookCount` for sign-off.

## Verify

`verify` fails closed on:

- missing index / books / LUT
- book ID `0`, gaps, or duplicates
- event index ≠ array position
- LUT ↔ book ID or payout mismatch
- non-positive weights
- zst line count ≠ jsonl line count
