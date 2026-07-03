import { type BotState } from "./storage.js";
import { totalYearsToDate, type GregorianDate } from "./calendar.js";

const MS_PER_DAY = 86400000;

export interface TimeResult {
  totalYears: number;
  date: GregorianDate;
  progress: number;
  rateText: string;
  paused: boolean;
  nextYearInMs: number;
}

export function calculateTime(state: BotState, now: number): TimeResult {
  let elapsedReal: number;

  if (state.paused) {
    elapsedReal = state.pausedAtMs - state.baseRealTimestamp - state.totalPausedMs;
  } else {
    elapsedReal = now - state.baseRealTimestamp - state.totalPausedMs;
  }

  const totalYears = state.baseInGameYears + (elapsedReal / MS_PER_DAY) * state.rateYears;
  const date = totalYearsToDate(totalYears);
  const progress = totalYears - Math.floor(totalYears);
  const rateText = `${state.rateYears} years per day`;

  const nextYearProgress = state.rateYears / MS_PER_DAY;
  const msLeftInYear = ((1 - progress) / nextYearProgress);

  return {
    totalYears,
    date,
    progress,
    rateText,
    paused: state.paused,
    nextYearInMs: Math.max(0, msLeftInYear),
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
    `Day: ${result.date.day} (Day ${result.date.dayOfYear} of ${result.date.totalDaysInYear})\n` +
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
