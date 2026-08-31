import type { Board, Cell, GameConfig, Position } from "./types.ts";
import { pickInt } from "./rng.ts";

export function cellFromName(game: GameConfig, name: string): Cell {
  const cell: Cell = { name };
  if (name === game.wild) cell.wild = true;
  if (name === game.scatter) cell.scatter = true;
  return cell;
}

export function spinBoard(
  game: GameConfig,
  strips: string[][],
  rng: () => number,
): { board: Board; paddingPositions: number[] } {
  const board: Board = [];
  const paddingPositions: number[] = [];
  for (let reel = 0; reel < game.reels; reel++) {
    const strip = strips[reel];
    const stop = pickInt(rng, strip.length);
    paddingPositions.push(stop);
    const column: Cell[] = [];
    for (let row = 0; row < game.rows; row++) {
      const name = strip[(stop + row) % strip.length];
      column.push(cellFromName(game, name));
    }
    board.push(column);
  }
  return { board, paddingPositions };
}

export type LineWin = {
  symbol: string;
  kind: number;
  win: number;
  positions: Position[];
};

export function evaluateLines(game: GameConfig, board: Board): LineWin[] {
  const wins: LineWin[] = [];
  for (const line of game.lines) {
    const cells = line.map((row, reel) => board[reel][row]);
    const firstPay = cells.find((c) => !c.scatter && !c.wild) ?? cells.find((c) => c.wild);
    if (!firstPay || firstPay.scatter) continue;
    const symbol = firstPay.wild ? game.wild : firstPay.name;
    let kind = 0;
    const positions: Position[] = [];
    for (let reel = 0; reel < cells.length; reel++) {
      const c = cells[reel];
      if (c.scatter) break;
      if (c.wild || c.name === symbol || (symbol === game.wild && !c.scatter)) {
        kind += 1;
        positions.push({ reel, row: line[reel] });
        continue;
      }
      break;
    }
    if (kind < 3) continue;
    const pay = game.paytable[symbol === game.wild ? wildPaySymbol(game, cells) : symbol];
    if (!pay) continue;
    const win = pay[kind - 3] ?? 0;
    if (win <= 0) continue;
    wins.push({
      symbol: symbol === game.wild ? wildPaySymbol(game, cells) : symbol,
      kind,
      win,
      positions,
    });
  }
  return wins;
}

function wildPaySymbol(game: GameConfig, cells: Cell[]): string {
  const named = cells.find((c) => !c.wild && !c.scatter);
  return named?.name ?? game.wild;
}

export function scatterPositions(game: GameConfig, board: Board): Position[] {
  const out: Position[] = [];
  for (let reel = 0; reel < board.length; reel++) {
    for (let row = 0; row < board[reel].length; row++) {
      if (board[reel][row].scatter) out.push({ reel, row });
    }
  }
  return out;
}

export function anticipation(game: GameConfig, board: Board): number[] {
  const flags = Array.from({ length: game.reels }, () => 0);
  let seen = 0;
  for (let reel = 0; reel < game.reels; reel++) {
    if (seen >= 2) flags[reel] = seen - 1;
    if (board[reel].some((c) => c.scatter)) seen += 1;
  }
  return flags;
}

export function forceScatterBoard(
  game: GameConfig,
  strips: string[][],
  rng: () => number,
  count: number,
): { board: Board; paddingPositions: number[] } {
  const spun = spinBoard(game, strips, rng);
  const want = Math.min(count, game.reels);
  const usedReels = new Set<number>();
  while (usedReels.size < want) {
    usedReels.add(pickInt(rng, game.reels));
  }
  for (const reel of usedReels) {
    const row = pickInt(rng, game.rows);
    spun.board[reel][row] = cellFromName(game, game.scatter);
  }
  return spun;
}
