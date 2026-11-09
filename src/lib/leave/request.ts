import {
  alreadyHaveRequest,
  CHOOSE_AT_LEAST_ONE_POSITION,
  COMMENT_TOO_LONG,
  NO_WORKING_HOURS,
  RELATIONSHIP_REQUIRED,
  schoolClosedOn,
} from "./messages";
import { closureOn, openBlocks } from "./closures";
import { blocksOn, validateHours, wholeDay } from "./schedule";
import { isValidDate, parseTime } from "./time";
import type {
  ExistingRecord,
  HoursInput,
  PlanContext,
  PlanErrorCode,
  PlanResult,
  PlannedRecord,
  Position,
  RequestInput,
  ScheduleBlock,
} from "./types";
import { COMMENT_MAX_LENGTH, LEAVE_TYPES, RELATIONSHIPS } from "./types";

const INVALID_INPUT = "Invalid request";

// Записи цих статусів блокують перетин; «Rejected» і «Cancelled» — ні (припущення PM, вимога 01).
const BLOCKING_STATUSES: ReadonlySet<string> = new Set(["awaiting_decision", "returned_for_revision", "approved"]);

// Інтервал [початок, кінець): 09:00–11:00 і 11:00–12:00 не перетинаються.
function overlaps(a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }): boolean {
  return parseTime(a.startsAt) < parseTime(b.endsAt) && parseTime(b.startsAt) < parseTime(a.endsAt);
}

function findConflict(record: PlannedRecord, existing: ExistingRecord[]): ExistingRecord | undefined {
  return existing.find(
    (other) =>
      BLOCKING_STATUSES.has(other.status) &&
      other.positionId === record.positionId &&
      other.date === record.date &&
      overlaps(record, other),
  );
}

type BuiltRecord = { ok: true; record: PlannedRecord } | { ok: false; code: PlanErrorCode; message: string };

// Запис однієї посади на дату за відкритими блоками: або обрані години (перевіряємо за блоками), або цілий день.
function buildRecord(position: Position, date: string, blocks: ScheduleBlock[], hours: HoursInput | undefined): BuiltRecord {
  if (hours) {
    const check = validateHours(blocks, hours.startsAt, hours.endsAt);
    if (!check.ok) {
      return { ok: false, code: check.code, message: check.message };
    }
    return {
      ok: true,
      record: {
        positionId: position.id,
        date,
        startsAt: hours.startsAt,
        endsAt: hours.endsAt,
        minutes: check.minutes,
        status: "awaiting_decision",
      },
    };
  }
  const day = wholeDay(blocks);
  return {
    ok: true,
    record: {
      positionId: position.id,
      date,
      startsAt: day.startsAt,
      endsAt: day.endsAt,
      minutes: day.minutes,
      status: "awaiting_decision",
    },
  };
}

// Будує записи відпустки з даних форми, нічого не пишучи й не читаючи з бази (чиста функція).
// Результат — або всі записи, або помилка без жодного запису («все або нічого», AC-LEAVE-16).
//
// Заявка — це дати × посади: на кожну дату береться кожна обрана посада, що має розклад у цей день тижня
// (Main scenario вимоги 01, крок 2). Дата, на яку не працює жодна обрана посада, не приймається (повертається в
// skippedDates, AC-LEAVE-21), а решта дат лишається; якщо не прийнято жодної дати — «No working hours» (AC-LEAVE-06).
// «Цілий день» (без hours) або години в межах розкладу (з hours).
// Порядок перевірок — рішення розробника (PM порядок не задав):
// посади → дата без годин чи закрита → години → спорідненість → довжина коментаря → перетин із наявними записами.
export function planRequest(input: RequestInput, context: PlanContext): PlanResult {
  if (!LEAVE_TYPES.includes(input.leaveType) || input.dates.length === 0 || !input.dates.every(isValidDate)) {
    return { ok: false, code: "INVALID_INPUT", message: INVALID_INPUT };
  }

  if (input.positionIds.length === 0) {
    return { ok: false, code: "NO_POSITION_CHOSEN", message: CHOOSE_AT_LEAST_ONE_POSITION };
  }

  // Посада не з контексту працівника — це чужа чи вигадана посада, а не помилка користувача.
  const chosen = [...new Set(input.positionIds)].map((id) => context.positions.find((p) => p.id === id));
  if (chosen.some((position) => !position)) {
    return { ok: false, code: "INVALID_INPUT", message: INVALID_INPUT };
  }

  const records: PlannedRecord[] = [];
  // Відкинуті дати за порядком вибору: без робочих годин (name відсутнє) чи закриті в шкільному календарі (AC-CAL-03).
  const rejected: { date: string; closedName?: string }[] = [];
  const closures = context.closures ?? [];

  for (const date of [...new Set(input.dates)]) {
    const closure = closureOn(closures, date);
    let hasSchedule = false;
    let hasOpenBlocks = false;

    for (const position of chosen) {
      if (!position) {
        continue;
      }
      const scheduled = blocksOn(position, date);
      if (scheduled.length === 0) {
        continue;
      }
      hasSchedule = true;
      // Закрита частина дня не входить у розклад: цілий день і години рахуємо лише за відкритими блоками.
      const blocks = openBlocks(scheduled, closure);
      if (blocks.length === 0) {
        continue;
      }
      hasOpenBlocks = true;

      const built = buildRecord(position, date, blocks, input.hours);
      if (!built.ok) {
        return built;
      }
      records.push(built.record);
    }

    // Дата без робочих годин (AC-LEAVE-21) чи закрита школою (AC-CAL-03) не приймається, а інші дати заявки лишаються.
    // День без розкладу всередині закриття лишається «без робочих годин»: закриття змінює лише дні, коли працівник працює.
    if (!hasSchedule) {
      rejected.push({ date });
    } else if (!hasOpenBlocks && closure) {
      rejected.push({ date, closedName: closure.name });
    }
  }

  // Жодної прийнятої дати — заявки немає (AC-LEAVE-06, AC-CAL-03): повідомлення про першу відкинуту дату.
  if (records.length === 0) {
    const first = rejected[0];
    return first?.closedName
      ? { ok: false, code: "SCHOOL_CLOSED", message: schoolClosedOn(first.closedName) }
      : { ok: false, code: "NO_WORKING_HOURS", message: NO_WORKING_HOURS };
  }

  if (input.leaveType === "family" && !(RELATIONSHIPS as readonly string[]).includes(input.relationship ?? "")) {
    return { ok: false, code: "RELATIONSHIP_REQUIRED", message: RELATIONSHIP_REQUIRED };
  }

  // Довжину рахуємо в символах (кодових точках), а не в UTF-16 одиницях: емодзі — один символ.
  const comment = input.comment?.trim() || undefined;
  if (comment && [...comment].length > COMMENT_MAX_LENGTH) {
    return { ok: false, code: "COMMENT_TOO_LONG", message: COMMENT_TOO_LONG };
  }

  // Перетини перевіряємо після того, як усі записи побудовано: один конфлікт скасовує всю заявку (AC-LEAVE-16).
  const existing = context.existing ?? [];
  for (const record of records) {
    const conflict = findConflict(record, existing);
    if (conflict) {
      return { ok: false, code: "TIME_CONFLICT", message: alreadyHaveRequest(conflict) };
    }
  }

  return {
    ok: true,
    leaveType: input.leaveType,
    // Коментар заявки лежить на кожному її записі (AC-LEAVE-17); спорідненість має сенс лише для "family".
    records: comment ? records.map((record) => ({ ...record, comment })) : records,
    relationship: input.leaveType === "family" ? input.relationship : undefined,
    comment,
    skippedDates: rejected.filter((item) => item.closedName === undefined).map((item) => item.date),
    skippedClosed: rejected
      .filter((item) => item.closedName !== undefined)
      .map((item) => ({ date: item.date, name: item.closedName as string })),
  };
}
