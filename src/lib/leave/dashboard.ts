import { schoolYearOf } from "./balance";
import { type Closure, closureOn } from "./closures";
import { weekdayOf } from "./time";
import { LEAVE_TYPES, RECORD_STATUSES, type LeaveType, type RecordStatus } from "./types";

// Статистика для головної (дашборду): чисті функції над записами, без бази й Next.js, тестуються без мережі.
// Рішення — docs/decisions/0008-bento-redesign.md. Дані дашборду лише ті, що користувач уже бачить під RLS.

const DAY_MS = 86_400_000;

const toMs = (date: string): number => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

export const addDays = (date: string, days: number): string => new Date(toMs(date) + days * DAY_MS).toISOString().slice(0, 10);

// Повних днів від `from` до `to` (від'ємне, якщо `to` раніше).
export const daysBetween = (from: string, to: string): number => Math.round((toMs(to) - toMs(from)) / DAY_MS);

// Місяці навчального року: вересень першим (так само, як рахує школа).
export const SCHOOL_MONTHS = ["Вер", "Жов", "Лис", "Гру", "Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер"] as const;

// 0 для вересня … 11 для серпня.
export const schoolMonthIndex = (date: string): number => (Number(date.slice(5, 7)) + 3) % 12;

export type DatedRecord = { date: string; status: RecordStatus; leaveType: LeaveType };

export function statusCounts(records: { status: RecordStatus }[]): Record<RecordStatus, number> {
  const counts = Object.fromEntries(RECORD_STATUSES.map((status) => [status, 0])) as Record<RecordStatus, number>;
  for (const record of records) {
    counts[record.status] += 1;
  }
  return counts;
}

export type Absence = { leaveType: LeaveType; status: RecordStatus; from: string; to: string; days: number };

// Чи є `next` продовженням відсутності `last`: наступний день або понеділок після п'ятниці.
function continues(last: Absence, next: DatedRecord): boolean {
  const gap = daysBetween(last.to, next.date);
  return gap === 1 || (gap === 3 && weekdayOf(last.to) === 5);
}

// Робочі дні одного типу й статусу, що йдуть підряд (п'ятниця й понеділок — підряд), зводимо в одну відсутність.
// Кожну пару «тип + статус» групуємо окремо, щоб інші статуси між днями не розривали послідовність; записи за різними
// посадами в той самий день рахуємо один раз. Результат упорядковано за початком.
export function groupAbsences(records: DatedRecord[]): Absence[] {
  const byKind = new Map<string, Map<string, DatedRecord>>();
  for (const record of records) {
    const kind = `${record.leaveType}|${record.status}`;
    byKind.set(kind, (byKind.get(kind) ?? new Map()).set(record.date, record));
  }
  const groups: Absence[] = [];
  for (const dates of byKind.values()) {
    let last: Absence | undefined;
    for (const record of [...dates.values()].sort((x, y) => x.date.localeCompare(y.date))) {
      if (last && continues(last, record)) {
        last.to = record.date;
        last.days += 1;
      } else {
        last = { leaveType: record.leaveType, status: record.status, from: record.date, to: record.date, days: 1 };
        groups.push(last);
      }
    }
  }
  return groups.sort((x, y) => x.from.localeCompare(y.from));
}

// Найближча відсутність, що ще не закінчилась: схвалена або та, що чекає рішення.
export function nextAbsence(absences: Absence[], today: string): (Absence & { daysUntil: number }) | null {
  const upcoming = absences
    .filter((absence) => absence.to >= today && (absence.status === "approved" || absence.status === "awaiting_decision"))
    .sort((a, b) => a.from.localeCompare(b.from))[0];
  return upcoming ? { ...upcoming, daysUntil: Math.max(0, daysBetween(today, upcoming.from)) } : null;
}

// Кількість днів за місяцями навчального року `year` (вересень … серпень).
export function monthlyCounts(dates: string[], year: number): number[] {
  const counts = Array.from({ length: 12 }, () => 0);
  for (const date of dates) {
    if (schoolYearOf(date) === year) {
      counts[schoolMonthIndex(date)] += 1;
    }
  }
  return counts;
}

export type TeamRecord = { employeeId: string; date: string; status: RecordStatus; leaveType: LeaveType };
export type TeamMember = { id: string; name: string };
export type HeatCell = "approved" | "awaiting" | "closed" | null;

export type TeamOverview = {
  size: number;
  outToday: TeamMember[];
  coveragePercent: number;
  days: string[]; // найближчі робочі дні вікна
  rows: { member: TeamMember; cells: HeatCell[] }[];
  riskDay: { date: string; percent: number } | null; // день із найнижчим покриттям у вікні (з урахуванням заявок, що чекають)
  monthly: number[]; // дні відсутності команди за місяцями навчального року (без скасованих і відхилених)
  mix: Record<LeaveType, number>;
};

const COUNTED: RecordStatus[] = ["approved", "awaiting_decision"];
type Presence = "approved" | "awaiting";

// Один запис на працівника й день: схвалений сильніший за той, що чекає. Ключ — "id|дата".
function indexPresence(records: TeamRecord[]): Map<string, Presence> {
  const presence = new Map<string, Presence>();
  for (const record of records) {
    const key = `${record.employeeId}|${record.date}`;
    if (COUNTED.includes(record.status) && presence.get(key) !== "approved") {
      presence.set(key, record.status === "approved" ? "approved" : "awaiting");
    }
  }
  return presence;
}

// Найближчі робочі дні (без вихідних) від `from`.
function workingDays(from: string, count: number): string[] {
  const days: string[] = [];
  for (let date = from; days.length < count; date = addDays(date, 1)) {
    if (weekdayOf(date) <= 5) {
      days.push(date);
    }
  }
  return days;
}

const isClosedDay = (closures: Closure[], date: string): boolean => closureOn(closures, date)?.closedFrom === null;

// День із найнижчим покриттям серед відкритих днів вікна; без відсутностей — null.
function lowestCoverage(days: string[], closures: Closure[], percentOn: (date: string) => number): TeamOverview["riskDay"] {
  let worst: TeamOverview["riskDay"] = null;
  for (const date of days.filter((day) => !isClosedDay(closures, day))) {
    const percent = percentOn(date);
    if (percent < 100 && (!worst || percent < worst.percent)) {
      worst = { date, percent };
    }
  }
  return worst;
}

// Перший запис для кожного ключа: працівник із двома посадами на одну дату — це один день відсутності, а не два.
function uniqueBy(records: TeamRecord[], key: (record: TeamRecord) => string): TeamRecord[] {
  return [...new Map(records.map((record) => [key(record), record])).values()];
}

function mixByType(records: TeamRecord[]): Record<LeaveType, number> {
  const mix = Object.fromEntries(LEAVE_TYPES.map((type) => [type, 0])) as Record<LeaveType, number>;
  for (const record of uniqueBy(records, (r) => `${r.employeeId}|${r.date}|${r.leaveType}`)) {
    mix[record.leaveType] += 1;
  }
  return mix;
}

// Огляд команди для менеджера й адміністратора: хто відсутній сьогодні, покриття, теплова карта найближчих робочих днів.
// `team` — працівники, яких бачить цей користувач; `records` — їхні записи за навчальний рік (під RLS).
export function buildTeamOverview(input: {
  team: TeamMember[];
  records: TeamRecord[];
  closures: Closure[];
  today: string;
  windowDays?: number;
}): TeamOverview {
  const { team, records, closures, today } = input;
  const presence = indexPresence(records);
  const days = workingDays(today, input.windowDays ?? 15);
  const presenceOf = (member: TeamMember, date: string) => presence.get(`${member.id}|${date}`);
  // Покриття дня: частка працівників, яких немає серед відсутніх зазначених видів.
  const coverageOn = (date: string, kinds: Presence[]) => {
    const away = team.filter((member) => kinds.includes(presenceOf(member, date) as Presence)).length;
    return team.length === 0 ? 100 : Math.round(((team.length - away) / team.length) * 100);
  };
  const counted = records.filter((record) => COUNTED.includes(record.status));

  return {
    size: team.length,
    outToday: team.filter((member) => presenceOf(member, today) === "approved"),
    coveragePercent: coverageOn(today, ["approved"]),
    days,
    rows: team.map((member) => ({
      member,
      cells: days.map((date): HeatCell => (isClosedDay(closures, date) ? "closed" : (presenceOf(member, date) ?? null))),
    })),
    riskDay: lowestCoverage(days, closures, (date) => coverageOn(date, ["approved", "awaiting"])),
    monthly: monthlyCounts(
      uniqueBy(counted, (r) => `${r.employeeId}|${r.date}`).map((record) => record.date),
      schoolYearOf(today),
    ),
    mix: mixByType(counted),
  };
}
