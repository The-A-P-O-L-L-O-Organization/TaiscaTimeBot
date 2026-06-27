import { type BotState } from "./storage.js";
import { totalYearsToDate, type GregorianDate } from "./calendar.js";

export interface TimeResult {
  totalYears: number;
  date: GregorianDate;
  progress: number;
  rateText: string;
  running: boolean;
  nextYearInMs: number;
  paused: boolean;
}

export function calculateTime(state: BotState, now: number): TimeResult {
  let elapsedReal: number;

  if (state.paused) {
    elapsedReal = state.pausedAtMs - state.baseRealTimestamp - state.totalPausedMs;
  } else {
    elapsedReal = now - state.baseRealTimestamp - state.totalPausedMs;
  }

  const totalYears = state.baseInGameYears + (elapsedReal / state.rateRealMs) * state.rateYears;
  const date = totalYearsToDate(totalYears);
  const progress = totalYears - Math.floor(totalYears);
  const rateMs = state.rateRealMs / state.rateYears;

  let rateText: string;
  if (state.rateRealMs === 86400000) {
    rateText = `${state.rateYears} years per day`;
  } else if (state.rateRealMs === 604800000) {
    rateText = `${state.rateYears} years per week`;
  } else if (state.rateRealMs === 2592000000) {
    rateText = `${state.rateYears} years per month`;
  } else {
    rateText = `${state.rateYears} years per ${state.rateRealMs}ms`;
  }

  const nextYearProgress = state.rateYears / state.rateRealMs;
  const msLeftInYear = ((1 - progress) / nextYearProgress);

  return {
    totalYears,
    date,
    progress,
    rateText,
    running: !state.paused && elapsedReal >= 0,
    nextYearInMs: Math.max(0, msLeftInYear),
    paused: state.paused,
  };
}

export function formatTime(result: TimeResult): string {
  const barLength = 24;
  const filled = Math.round(result.progress * barLength);
  const empty = barLength - filled;
  const bar = "|".repeat(filled) + ".".repeat(empty);

  const nextYear = formatDuration(result.nextYearInMs);
  const status = result.paused ? "Paused" : "Running";

  return (
    `Current In-Game Time:\n` +
    `Year ${result.date.year}\n` +
    `Month: ${result.date.monthName} (Month ${result.date.month}/12)\n` +
    `Day: ${result.date.day} (Day ${result.date.dayOfYear} of Year ${result.date.year})\n` +
    `Week: ${result.date.week} of ~${Math.ceil(result.date.totalDaysInYear / 7)}\n` +
    `[${bar}] ${(result.progress * 100).toFixed(1)}% through Year ${result.date.year}\n` +
    `\n` +
    `Progression: ${result.rateText} -- Next year change in ~${nextYear}\n` +
    `Status: ${status}`
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
