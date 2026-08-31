import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateGame } from "./generate.ts";
import { verifyPublishDir } from "./validate.ts";
import type { GameConfig } from "./types.ts";

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function usage(): never {
  console.error(`oneshot-math

  generate --game <path-to-game.ts> --out <dir> --mode <all|name>
  verify   --dir <publish_files>
`);
  process.exit(2);
}

async function loadGame(gamePath: string): Promise<GameConfig> {
  const url = pathToFileURL(resolve(gamePath)).href;
  const mod = (await import(url)) as { default?: GameConfig; demoLines?: GameConfig; game?: GameConfig };
  const game = mod.default ?? mod.game ?? mod.demoLines;
  if (!game?.id || !game.modes) {
    throw new Error(`No GameConfig export in ${gamePath}`);
  }
  return game;
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "generate") {
    const gamePath = arg("--game");
    const outDir = arg("--out");
    const mode = arg("--mode", "all");
    if (!gamePath || !outDir || !mode) usage();
    const game = await loadGame(gamePath);
    const result = await generateGame(game, { outDir, modes: mode });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (cmd === "verify") {
    const dir = arg("--dir");
    if (!dir) usage();
    const issues = verifyPublishDir(dir);
    if (issues.length === 0) {
      console.log("ok");
      return;
    }
    for (const issue of issues) {
      console.error(`${issue.level}: ${issue.message}`);
    }
    process.exit(issues.some((i) => i.level === "blocker") ? 1 : 0);
  }
  usage();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
