// ──────────────────────────────────────────────
// Turn-Game Registry
// ──────────────────────────────────────────────
// Game-type → engine lookup. The engine list is codegen'd from each
// turn-games/<gameType>/engine.manifest.ts (see registry.generated.ts), so
// adding a game is one folder + `pnpm build:shared`.

import type { AnyTurnGameEngine } from "./engine.types.js";
import { TURN_GAME_ENGINES } from "./registry.generated.js";

export const GAME_ENGINE_REGISTRY: Readonly<Record<string, AnyTurnGameEngine>> = Object.freeze(
  Object.fromEntries(TURN_GAME_ENGINES.map((engine) => [engine.gameType, engine])),
);

export function getTurnGameEngine(gameType: string): AnyTurnGameEngine | null {
  return GAME_ENGINE_REGISTRY[gameType] ?? null;
}

export interface TurnGameSummary {
  gameType: string;
  label: string;
  minPlayers: number;
  maxPlayers: number;
}

/** Lightweight catalog for the client's game picker. */
export function listTurnGames(): TurnGameSummary[] {
  return TURN_GAME_ENGINES.map((engine) => ({
    gameType: engine.gameType,
    label: engine.label,
    minPlayers: engine.minPlayers,
    maxPlayers: engine.maxPlayers,
  }));
}

export const TURN_GAME_TYPES: readonly string[] = TURN_GAME_ENGINES.map((engine) => engine.gameType);
