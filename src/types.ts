export type Cell = {
  name: string;
  wild?: boolean;
  scatter?: boolean;
};

/** Reel-major board: board[reel][row] */
export type Board = Cell[][];

export type Position = { reel: number; row: number };

export type BookEvent = {
  index: number;
  type: string;
  [key: string]: unknown;
};

export type BookRecord = {
  id: number;
  payoutMultiplier: number;
  events: BookEvent[];
  criteria: string;
  baseGameWins: number;
  freeGameWins: number;
};

export type LutRow = {
  id: number;
  weight: number;
  payoutMultiplier: number;
};

export type ModeKind = "base" | "bonus";

export type ModeConfig = {
  name: string;
  cost: number;
  rtp: number;
  maxWin: number;
  bookCount: number;
  kind: ModeKind;
};

export type GameConfig = {
  id: string;
  name: string;
  maxWinX: number;
  rtp: number;
  reels: number;
  rows: number;
  /** Pay for 3 / 4 / 5 of a kind on a line, in bet units. */
  paytable: Record<string, readonly [number, number, number]>;
  wild: string;
  scatter: string;
  scatterPays: Record<number, number>;
  scatterToFreespins: Record<number, number>;
  retriggerFreespins: number;
  maxFreespins: number;
  lines: number[][];
  strips: {
    base: string[][];
    feature: string[][];
  };
  modes: ModeConfig[];
  /**
   * Max payout as a multiple of mode cost for non-wincap books.
   * High multipliers exist only on wincap.
   */
  naturalCeilingX: number;
  /** Target P(select wincap). Capped internally so tail variance stays low. */
  wincapHitRate?: number;
};

export type GenerateOptions = {
  outDir: string;
  /** Isolated one-shot. `all` still runs each mode as its own ID space. */
  modes: "all" | string;
};

export type VolatilityBand = "low" | "medium" | "high";

export type VolatilityStats = {
  mean: number;
  stdev: number;
  cv: number;
  band: VolatilityBand;
  hitRate: number;
  wincapHitRate: number;
  definition: string;
};

export type BandRow = {
  name: string;
  minPayout: number;
  maxPayout: number;
  books: number;
  weight: number;
  hitRate: number;
  rtp: number;
};

export type ModeResult = {
  name: string;
  cost: number;
  bookCount: number;
  rtpRaw: number;
  rtpWeighted: number;
  rtpTarget: number;
  maxWinObserved: number;
  maxWinCap: number;
  naturalCeiling: number;
  zeroBooks: number;
  maxWinBooks: number;
  illegalHighBooks: number;
  volatility: VolatilityStats;
};

export type GenerateResult = {
  gameId: string;
  publishDir: string;
  mathFile: string;
  modes: ModeResult[];
};
