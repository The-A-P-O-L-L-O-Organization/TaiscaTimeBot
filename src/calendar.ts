export interface GregorianDate {
  year: number;
  month: number;
  monthName: string;
  day: number;
  dayOfYear: number;
  week: number;
  totalDaysInYear: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS_IN_MONTH_COMMON = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DAYS_IN_MONTH_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function totalYearsToDate(totalYears: number): GregorianDate {
  const year = Math.floor(totalYears);
  const remainder = totalYears - year;
  const dayCount = daysInYear(year);
  const dayOfYear = Math.floor(remainder * dayCount) + 1;

  const daysInMonths = isLeapYear(year) ? DAYS_IN_MONTH_LEAP : DAYS_IN_MONTH_COMMON;

  let cumulative = 0;
  let month = 0;
  for (let i = 0; i < 12; i++) {
    if (dayOfYear <= cumulative + daysInMonths[i]) {
      month = i;
      break;
    }
    cumulative += daysInMonths[i];
  }

  const day = dayOfYear - cumulative;
  const week = Math.floor((dayOfYear - 1) / 7) + 1;

  return {
    year,
    month: month + 1,
    monthName: MONTHS[month],
    day,
    dayOfYear,
    week,
    totalDaysInYear: dayCount,
  };
}
