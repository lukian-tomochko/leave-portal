import { parseTime, weekdayOf } from "./time";
import type { LeaveType, Position } from "./types";

// Баланс відпусток (вимога 03, AC-BALANCE-01…22): чиста функція над даними, без залежностей від бази й Next.js.
// База віддає вхідні дані (посади з розкладом і схвалені записи) тим, кому дозволено (функція employee_balance_inputs);
// розрахунок тут тестується без бази. Рішення — docs/decisions/0005-balance-computed-in-app.md.
//
// Усі частки дня рахуємо цілими «сотими дня» (100 = 1.00 день): без похибок плаваючої крапки.

export const GRANTED_CENTS = 1800; // 18.00 днів на навчальний рік для "Sick leave" і "Personal leave" (припущення PM)

export type ApprovedRecord = {
  id: string;
  positionId: string;
  date: string; // "YYYY-MM-DD"
  startsAt: string;
  endsAt: string;
  leaveType: LeaveType;
  // Розподіл при схваленні (AC-BALANCE-10, AC-BALANCE-19): частки дня в сотих; без розподілу — null й 0.
  paidCents: number | null;
  unpaidCents: number;
};

export type BalanceInputs = {
  positions: Position[]; // усі посади працівника з розкладом (частка дня рахується за всіма посадами)
  records: ApprovedRecord[]; // лише схвалені записи
};

export type LimitedBalance = { granted: number; carriedOver: number; used: number; remaining: number };
export type CountedBalance = { used: number };

export type YearBalances = {
  year: number; // рік початку навчального року
  label: string; // "2026–2027"
  sick: LimitedBalance;
  personal: LimitedBalance;
  unpaid: CountedBalance;
  family: CountedBalance;
};

export const schoolYearOf = (date: string): number => {
  weekdayOf(date); // перевірка дати
  const [year, month] = date.split("-").map(Number);
  return month >= 9 ? year : year - 1; // навчальний рік: з 1 вересня до 31 серпня
};

export const schoolYearLabel = (year: number): string => `${year}–${year + 1}`;

// Дні з сотих: 150 → 1.5 (для відображення викликайте formatDays).
export const toDays = (cents: number): number => cents / 100;

// 50 → "0.50", 1800 → "18.00".
export const formatDays = (cents: number): string => (cents / 100).toFixed(2);

// round half up для додатних дробів у цілих: floor((2·100·n + d) / (2·d)); 0.355 дня → 36 сотих.
const shareCents = (minutes: number, totalMinutes: number): number => {
  if (totalMinutes <= 0 || minutes <= 0) {
    return 0;
  }
  return Math.min(100, Math.floor((200 * minutes + totalMinutes) / (2 * totalMinutes)));
};

const blocksOn = (position: Position, date: string) => {
  const weekday = weekdayOf(date);
  return position.blocks.filter((block) => block.weekday === weekday);
};

// Усі робочі хвилини працівника на дату за розкладами всіх його посад.
export function workingMinutes(positions: Position[], date: string): number {
  return positions.reduce(
    (sum, position) =>
      sum +
      blocksOn(position, date).reduce((blockSum, block) => blockSum + (parseTime(block.endsAt) - parseTime(block.startsAt)), 0),
    0,
  );
}

// Хвилини запису лише в межах блоків розкладу його посади (проміжок між блоками не рахується).
export function recordMinutes(position: Position | undefined, record: { date: string; startsAt: string; endsAt: string }): number {
  if (!position) {
    return 0;
  }
  const start = parseTime(record.startsAt);
  const end = parseTime(record.endsAt);
  return blocksOn(position, record.date).reduce(
    (sum, block) => sum + Math.max(0, Math.min(end, parseTime(block.endsAt)) - Math.max(start, parseTime(block.startsAt))),
    0,
  );
}

type Usage = { sick: number; personal: number; unpaid: number; family: number };
const emptyUsage = (): Usage => ({ sick: 0, personal: 0, unpaid: 0, family: 0 });

// Використання за навчальними роками з схвалених записів. Частку дня рахуємо окремо для кожної дати й типу:
// хвилини записів ÷ усі робочі хвилини працівника на цю дату (за всіма посадами), округлення half up, не більше 1.00.
// Розподіл при схваленні переносить частину з "Personal leave" у "Unpaid leave".
export function usageByYear(inputs: BalanceInputs): Map<number, Usage> {
  const positionById = new Map(inputs.positions.map((position) => [position.id, position]));
  const groups = new Map<string, { date: string; type: LeaveType; minutes: number; unpaid: number }>();
  for (const record of inputs.records) {
    const key = `${record.date}|${record.leaveType}`;
    const group = groups.get(key) ?? { date: record.date, type: record.leaveType, minutes: 0, unpaid: 0 };
    group.minutes += recordMinutes(positionById.get(record.positionId), record);
    group.unpaid += record.unpaidCents;
    groups.set(key, group);
  }

  const usage = new Map<number, Usage>();
  for (const group of groups.values()) {
    const year = schoolYearOf(group.date);
    const current = usage.get(year) ?? emptyUsage();
    const total = shareCents(group.minutes, workingMinutes(inputs.positions, group.date));
    const unpaid = Math.min(group.unpaid, total);
    current[group.type] += total - unpaid;
    current.unpaid += unpaid;
    usage.set(year, current);
  }
  return usage;
}

// Баланси навчального року `year` (перенесення залишків із попередніх років повністю, без обмежень; припущення PM).
export function balancesForYear(inputs: BalanceInputs, year: number): YearBalances {
  const usage = usageByYear(inputs);
  const firstYear = Math.min(year, ...inputs.records.map((record) => schoolYearOf(record.date)));

  const carried = { sick: 0, personal: 0 };
  let result: YearBalances | null = null;
  for (let current = firstYear; current <= year; current += 1) {
    const used = usage.get(current) ?? emptyUsage();
    const sickRemaining = GRANTED_CENTS + carried.sick - used.sick;
    const personalRemaining = GRANTED_CENTS + carried.personal - used.personal;
    result = {
      year: current,
      label: schoolYearLabel(current),
      sick: {
        granted: toDays(GRANTED_CENTS),
        carriedOver: toDays(carried.sick),
        used: toDays(used.sick),
        remaining: toDays(sickRemaining),
      },
      personal: {
        granted: toDays(GRANTED_CENTS),
        carriedOver: toDays(carried.personal),
        used: toDays(used.personal),
        remaining: toDays(personalRemaining),
      },
      unpaid: { used: toDays(used.unpaid) },
      family: { used: toDays(used.family) },
    };
    // Невикористане переходить у наступний рік повністю; від'ємний залишок не переноситься.
    carried.sick = Math.max(0, sickRemaining);
    carried.personal = Math.max(0, personalRemaining);
  }
  // Цикл виконується щонайменше раз (firstYear <= year).
  return result as YearBalances;
}

// Баланси на дату `today` (поточний навчальний рік).
export function balancesOn(inputs: BalanceInputs, today: string): YearBalances {
  return balancesForYear(inputs, schoolYearOf(today));
}

const remainingCents = (inputs: BalanceInputs, year: number): number =>
  Math.round(balancesForYear(inputs, year).personal.remaining * 100);

export type PlannedHours = { positionId: string; date: string; startsAt: string; endsAt: string };

// Скільки сотих дня займає запит (за датами, у межах навчальних років) і скільки з них не покриває залишок "Personal leave".
// Залишок рахуємо за схваленими записами (AC-BALANCE-04, AC-BALANCE-14).
function requestOverBalance(inputs: BalanceInputs, planned: PlannedHours[]) {
  const positionById = new Map(inputs.positions.map((position) => [position.id, position]));
  const minutesByDate = new Map<string, number>();
  for (const item of planned) {
    minutesByDate.set(item.date, (minutesByDate.get(item.date) ?? 0) + recordMinutes(positionById.get(item.positionId), item));
  }
  const requestedByYear = new Map<number, number>();
  for (const [date, minutes] of minutesByDate) {
    const year = schoolYearOf(date);
    requestedByYear.set(year, (requestedByYear.get(year) ?? 0) + shareCents(minutes, workingMinutes(inputs.positions, date)));
  }

  let remaining = 0;
  let excess = 0;
  for (const [year, requested] of requestedByYear) {
    const left = remainingCents(inputs, year);
    remaining += Math.max(0, left);
    excess += Math.max(0, requested - Math.max(0, left));
  }
  return { remaining, excess };
}

// Попередження працівнику, коли заявка "Personal leave" перевищує баланс (AC-BALANCE-08, AC-BALANCE-15, AC-BALANCE-17).
// Заявка все одно створюється: це попередження, а не помилка. Для інших типів PM тексту не дав, тож null.
export function requestWarning(inputs: BalanceInputs, leaveType: LeaveType, planned: PlannedHours[]): string | null {
  if (leaveType !== "personal" || planned.length === 0) {
    return null;
  }
  const { remaining, excess } = requestOverBalance(inputs, planned);
  if (excess <= 0) {
    return null;
  }
  return `Your Personal leave balance is ${formatDays(remaining)} day. Another ${formatDays(excess)} day will be counted as Unpaid leave`;
}

export type RecordForDecision = { leaveType: LeaveType; positionId: string; date: string; startsAt: string; endsAt: string };

export type SplitSuggestion = { paidCents: number; unpaidCents: number; remainingCents: number; message: string };

// Підказка менеджеру для запису, що перевищує баланс "Personal leave" (AC-BALANCE-09, AC-BALANCE-14, AC-BALANCE-19):
// оплачувана частина до залишку, неоплачувана на решту. Для записів у межах балансу чи інших типів — null.
export function suggestSplit(inputs: BalanceInputs, record: RecordForDecision): SplitSuggestion | null {
  if (record.leaveType !== "personal") {
    return null;
  }
  const { remaining, excess } = requestOverBalance(inputs, [record]);
  if (excess <= 0) {
    return null;
  }
  const paidCents = shareOfRecord(inputs, record) - excess;
  return {
    paidCents,
    unpaidCents: excess,
    remainingCents: remaining,
    message: `This request exceeds the Personal leave balance (${formatDays(remaining)} day). Suggested: ${formatDays(paidCents)} day Personal leave, ${formatDays(excess)} day Unpaid leave`,
  };
}

function shareOfRecord(inputs: BalanceInputs, record: RecordForDecision): number {
  const position = inputs.positions.find((item) => item.id === record.positionId);
  return shareCents(recordMinutes(position, record), workingMinutes(inputs.positions, record.date));
}

// «The Personal leave balance is 0.50 day: approve with the suggested split or reject» (AC-BALANCE-16).
export const approveWithoutSplitRefused = (remainingCents: number): string =>
  `The Personal leave balance is ${formatDays(remainingCents)} day: approve with the suggested split or reject`;

export type ApprovalPlan =
  | { ok: true; paidCents: number | null; unpaidCents: number }
  | { ok: false; code: "SPLIT_REQUIRED"; message: string };

// План схвалення. Якщо запис перевищує баланс, схвалити повністю як "Personal leave" не можна (AC-BALANCE-16):
// потрібен розподіл. Без перевищення розподілу немає.
export function planApproval(inputs: BalanceInputs, record: RecordForDecision, withSplit: boolean): ApprovalPlan {
  const suggestion = suggestSplit(inputs, record);
  if (!suggestion) {
    return { ok: true, paidCents: null, unpaidCents: 0 };
  }
  if (!withSplit) {
    return { ok: false, code: "SPLIT_REQUIRED", message: approveWithoutSplitRefused(suggestion.remainingCents) };
  }
  return { ok: true, paidCents: suggestion.paidCents, unpaidCents: suggestion.unpaidCents };
}

// Розподіл у «My requests» (AC-BALANCE-18): "0.50 Personal leave + 0.50 Unpaid leave"; без розподілу — null.
export function splitText(paidCents: number | null, unpaidCents: number): string | null {
  if (unpaidCents <= 0 || paidCents === null) {
    return null;
  }
  return `${formatDays(paidCents)} Personal leave + ${formatDays(unpaidCents)} Unpaid leave`;
}
