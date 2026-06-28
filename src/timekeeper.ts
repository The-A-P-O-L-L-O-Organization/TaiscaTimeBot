import { type BotState } from "./storage.js";
import { totalYearsToDate, type GregorianDate } from "./calendar.js";

export interface TimeResult {
  totalYears: number;
  date: GregorianDate;
  progress: number;
  rateText: string;
  paused: boolean;
}

export function calculateTime(state: BotState): TimeResult {
  const totalYears = state.totalYears;
  const date = totalYearsToDate(totalYears);
  const progress = totalYears - Math.floor(totalYears);
  const rateText = `${state.rateYears} years per day`;

  return {
    totalYears,
    date,
    progress,
    rateText,
    paused: state.paused,
  };
}

export function formatTime(result: TimeResult): string {
  const barLength = 24;
  const filled = Math.round(result.progress * barLength);
  const empty = barLength - filled;
  const bar = "|".repeat(filled) + ".".repeat(empty);

  const status = result.paused ? "Paused" : "Running";

  return (
    `Current In-Game Time:\n` +
    `Year ${result.date.year}\n` +
    `Month: ${result.date.monthName} (Month ${result.date.month}/12)\n` +
    `Day: ${result.date.day} (Day ${result.date.dayOfYear} of ${result.date.totalDaysInYear})\n` +
    `Week: ${result.date.week} of ~${Math.ceil(result.date.totalDaysInYear / 7)}\n` +
    `[${bar}] ${(result.progress * 100).toFixed(1)}% through Year ${result.date.year}\n` +
    `\n` +
    `Progression: ${result.rateText} -- Next tick at midnight UTC\n` +
    `Status: ${status}`
  );
}
