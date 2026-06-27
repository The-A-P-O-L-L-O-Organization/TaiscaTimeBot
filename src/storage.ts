import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const STATE_PATH = join(DATA_DIR, "state.json");

export interface BotState {
  baseRealTimestamp: number;
  baseInGameYears: number;
  rateYears: number;
  rateRealMs: number;
  paused: boolean;
  pausedAtMs: number;
  totalPausedMs: number;
}

const DEFAULTS: BotState = {
  baseRealTimestamp: Date.now(),
  baseInGameYears: 0,
  rateYears: 4,
  rateRealMs: 86400000,
  paused: false,
  pausedAtMs: 0,
  totalPausedMs: 0,
};

function isValidState(obj: unknown): obj is BotState {
  if (typeof obj !== "object" || obj === null) return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.baseRealTimestamp === "number" &&
    typeof s.baseInGameYears === "number" &&
    typeof s.rateYears === "number" &&
    typeof s.rateRealMs === "number" &&
    typeof s.paused === "boolean" &&
    typeof s.pausedAtMs === "number" &&
    typeof s.totalPausedMs === "number"
  );
}

export function loadState(): BotState {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    const raw = readFileSync(STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (isValidState(parsed)) {
      return parsed;
    }
    console.warn("Invalid state.json, resetting to defaults");
  } catch (err) {
    console.warn("Could not read state.json, resetting to defaults:", err);
  }
  return { ...DEFAULTS };
}

export function saveState(state: BotState): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}
