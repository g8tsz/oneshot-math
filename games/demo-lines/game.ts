import type { GameConfig } from "../../src/types.ts";

const LINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [1, 2, 2, 2, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [0, 2, 2, 2, 0],
];

function strip(parts: string): string[] {
  return parts.split(",");
}

/** Dense lows, sparse premiums — frequent small hits, no fat 5-oak. */
const BASE = [
  strip("L5,L5,L4,L4,L3,L5,L2,L4,L5,L3,L1,L5,L4,L3,WILD,L5,L4,L2,L5,L3,L4,L5,H3,L4,L5,L3,S,L5,L4,L2,L5,L3,L4,H2,L5,L4,L3,L5,L1,L4"),
  strip("L4,L5,L5,L3,L4,L5,L2,L5,L4,L3,L5,L1,L4,L5,WILD,L3,L5,L4,L2,L5,L3,L4,H3,L5,L4,L3,S,L5,L4,L2,L3,L5,L4,H2,L5,L3,L4,L5,L1,L4"),
  strip("L5,L4,L3,L5,L4,L5,L2,L4,L5,L3,L5,L1,L4,L5,WILD,L3,L4,L5,L2,L4,L5,L3,H3,L5,L4,L3,S,L4,L5,L2,L5,L3,L4,H2,L5,L4,L3,L5,L1,L5"),
  strip("L3,L5,L4,L5,L3,L4,L2,L5,L4,L5,L3,L1,L5,L4,WILD,L5,L3,L4,L2,L5,L4,L3,H3,L5,L4,L5,S,L3,L4,L2,L5,L4,L3,H2,L5,L4,L3,L5,L1,L4"),
  strip("L4,L5,L3,L4,L5,L3,L2,L4,L5,L3,L4,L1,L5,L4,WILD,L5,L3,L4,L2,L5,L4,L3,H3,L4,L5,L3,S,L5,L4,L2,L3,L5,L4,H1,L5,L4,L3,L5,L1,L4"),
];

const FEATURE = BASE.map((reel) => reel.filter((s) => s !== "S").concat(["S"]));

export const demoLines: GameConfig = {
  id: "demo-lines",
  name: "Demo Lines",
  maxWinX: 5000,
  rtp: 0.96,
  naturalCeilingX: 12,
  reels: 5,
  rows: 3,
  paytable: {
    L5: [1, 2, 4],
    L4: [1, 3, 5],
    L3: [2, 4, 6],
    L2: [2, 5, 8],
    L1: [3, 6, 10],
    H3: [4, 8, 12],
    H2: [5, 10, 12],
    H1: [6, 10, 12],
    WILD: [6, 10, 12],
  },
  wild: "WILD",
  scatter: "S",
  scatterPays: { 3: 1, 4: 3, 5: 6 },
  scatterToFreespins: { 3: 5, 4: 6, 5: 8 },
  retriggerFreespins: 3,
  maxFreespins: 10,
  lines: LINES,
  strips: { base: BASE, feature: FEATURE },
  modes: [
    {
      name: "base",
      cost: 1,
      rtp: 0.96,
      maxWin: 5000,
      bookCount: 400,
      kind: "base",
    },
    {
      name: "bonus",
      cost: 100,
      rtp: 0.96,
      maxWin: 5000,
      bookCount: 120,
      kind: "bonus",
    },
  ],
};

export default demoLines;
