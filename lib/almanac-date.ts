export const ALMANAC_TIME_ZONE = "America/Chicago";

const DATE_PART_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: ALMANAC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function almanacTodayIso(now: Date = new Date()): string {
  const parts = DATE_PART_FORMATTER.formatToParts(now);
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not format Almanac date");
  }
  return `${year}-${month}-${day}`;
}

export function addDaysToIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function almanacIsoForOffset(offset: number, now: Date = new Date()): string {
  return addDaysToIso(almanacTodayIso(now), offset);
}

export function localDateFromIso(dateIso: string): Date {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function daysSinceAlmanacEpoch(dateIso: string): number {
  const [year, month, day] = dateIso.split("-").map(Number);
  const epoch = Date.UTC(2025, 9, 31);
  const current = Date.UTC(year, month - 1, day);
  return Math.round((current - epoch) / 86_400_000);
}

export function almanacEditionNumber(dateIso: string): string {
  return `No. ${daysSinceAlmanacEpoch(dateIso) + 1}`;
}
