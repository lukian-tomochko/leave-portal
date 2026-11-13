import { schoolYearOf } from "./balance";
import { type Closure, closureOn, describeClosure, parseSchoolYear } from "./closures";
import type { LeaveType, RecordStatus } from "./types";

// Допоміжні функції календаря (місячна сітка й річна стрічка): чисті, без бази й Next.js, тестуються без мережі.
// Місяць у адресі — "YYYY-MM" (?month=2026-11), навчальний рік — число початку (?year=2026).

export const MONTHS_UK = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
] as const;

export const WEEKDAYS_UK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"] as const;

const MONTHS_GENITIVE = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
] as const;

// «13 листопада» для підписів дня (без Intl: однаково на сервері й у браузері).
export const dayLabel = (date: string): string => `${Number(date.slice(8, 10))} ${MONTHS_GENITIVE[Number(date.slice(5, 7)) - 1]}`;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

// Місяць із параметра: "YYYY-MM" у межах 2000–2100, інакше запасний.
export function parseMonth(value: string | string[] | undefined, fallback: string): string {
  const text = Array.isArray(value) ? value[0] : value;
  const match = text ? MONTH_RE.exec(text) : null;
  if (!match) {
    return fallback;
  }
  const year = Number(match[1]);
  return year >= 2000 && year <= 2100 ? `${match[1]}-${match[2]}` : fallback;
}

// Місяць зі зсувом: shiftMonth("2026-12", 1) → "2027-01".
export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split("-").map(Number);
  const index = year * 12 + (number - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export const monthLabel = (month: string): string => `${MONTHS_UK[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

export type CalendarView = "month" | "year";

// Що показує календар за адресою (?view=, ?month=, ?year=). Місяць має пріоритет: рік списку завжди той, до якого належить
// обраний місяць. Без ?month= беремо ?year= (як було до сітки), а місяць — поточний, якщо він у цьому році, інакше вересень.
export function resolveCalendar(
  params: { month?: string | string[]; year?: string | string[]; view?: string | string[] },
  today: string,
): { year: number; month: string; view: CalendarView } {
  const monthParam = parseMonth(params.month, "");
  const year = monthParam ? schoolYearOfMonth(monthParam) : parseSchoolYear(params.year, schoolYearOf(today));
  const view = (Array.isArray(params.view) ? params.view[0] : params.view) === "year" ? "year" : "month";
  return { year, month: monthParam || defaultMonth(today, year), view };
}

// Навчальний рік, до якого належить місяць (вересень–грудень — рік початку, січень–серпень — попередній).
export const schoolYearOfMonth = (month: string): number => schoolYearOf(`${month}-01`);

// Перший місяць навчального року, у якому лежить `today`, а інакше вересень року `year`.
export function defaultMonth(today: string, year: number): string {
  return schoolYearOf(today) === year ? today.slice(0, 7) : `${year}-09`;
}

export type DayCell = { date: string; day: number; weekend: boolean };

// Клітинки місяця: порожні для вирівнювання за понеділком (null), потім усі дні.
export function monthCells(month: string): (DayCell | null)[] {
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells: (DayCell | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= count; day++) {
    const weekday = (offset + day - 1) % 7;
    cells.push({ date: `${month}-${String(day).padStart(2, "0")}`, day, weekend: weekday >= 5 });
  }
  return cells;
}

export type DayInfo = {
  closure?: { name: string; early: boolean; text: string };
  mine?: { leaveType: LeaveType; status: RecordStatus }[];
  away?: { employeeId: string; name: string; status: RecordStatus }[];
};

// Дані днів місяця для сітки: закриття, власні записи і (для менеджера) відсутні працівники.
export function buildDayMap(input: {
  month: string;
  closures: Closure[];
  mine: { date: string; leaveType: LeaveType; status: RecordStatus }[];
  team?: { employeeId: string; name: string; date: string; status: RecordStatus }[];
}): Record<string, DayInfo> {
  const map: Record<string, DayInfo> = {};
  for (const cell of monthCells(input.month)) {
    if (!cell) {
      continue;
    }
    const closure = closureOn(input.closures, cell.date);
    if (closure) {
      map[cell.date] = { closure: { name: closure.name, early: closure.closedFrom !== null, text: describeClosure(closure) } };
    }
  }
  const at = (date: string): DayInfo | null => (date.startsWith(input.month) ? (map[date] ??= {}) : null);
  for (const record of input.mine) {
    const day = at(record.date);
    if (day) {
      (day.mine ??= []).push({ leaveType: record.leaveType, status: record.status });
    }
  }
  for (const record of input.team ?? []) {
    const day = at(record.date);
    if (day && !day.away?.some((entry) => entry.employeeId === record.employeeId)) {
      (day.away ??= []).push({ employeeId: record.employeeId, name: record.name, status: record.status });
    }
  }
  return map;
}
