import {
  alreadyHaveRequest,
  CHOOSE_AT_LEAST_ONE_POSITION,
  COMMENT_TOO_LONG,
  NO_WORKING_HOURS,
  RELATIONSHIP_REQUIRED,
} from "./messages";
import { blocksOn, validateHours, wholeDay } from "./schedule";
import { isValidDate, parseTime } from "./time";
import type { ExistingRecord, PlanContext, PlanResult, PlannedRecord, RequestInput } from "./types";
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

// Будує записи відпустки з даних форми, нічого не пишучи й не читаючи з бази (чиста функція).
// Результат — або всі записи, або помилка без жодного запису («все або нічого», AC-LEAVE-16).
//
// Заявка — це дати × посади: на кожну дату береться кожна обрана посада, що має розклад у цей день тижня
// (Main scenario вимоги 01, крок 2). Дата, на яку не працює жодна обрана посада, не приймається (повертається в
// skippedDates, AC-LEAVE-21), а решта дат лишається; якщо не прийнято жодної дати — «No working hours» (AC-LEAVE-06).
// «Цілий день» (без hours) або години в межах розкладу (з hours).
// Порядок перевірок — рішення розробника (PM порядок не задав):
// посади → дата без годин → години → спорідненість → довжина коментаря → перетин із наявними записами.
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
  const skippedDates: string[] = [];

  for (const date of [...new Set(input.dates)]) {
    let anyWorking = false;

    for (const position of chosen) {
      if (!position) {
        continue;
      }
      const blocks = blocksOn(position, date);
      if (blocks.length === 0) {
        continue;
      }
      anyWorking = true;

      if (input.hours) {
        const check = validateHours(blocks, input.hours.startsAt, input.hours.endsAt);
        if (!check.ok) {
          return { ok: false, code: check.code, message: check.message };
        }
        records.push({
          positionId: position.id,
          date,
          startsAt: input.hours.startsAt,
          endsAt: input.hours.endsAt,
          minutes: check.minutes,
          status: "awaiting_decision",
        });
      } else {
        const day = wholeDay(blocks);
        records.push({
          positionId: position.id,
          date,
          startsAt: day.startsAt,
          endsAt: day.endsAt,
          minutes: day.minutes,
          status: "awaiting_decision",
        });
      }
    }

    // Дата без робочих годин не приймається, а інші дати заявки лишаються (AC-LEAVE-21).
    if (!anyWorking) {
      skippedDates.push(date);
    }
  }

  // Жодної прийнятої дати — заявки немає (AC-LEAVE-06).
  if (records.length === 0) {
    return { ok: false, code: "NO_WORKING_HOURS", message: NO_WORKING_HOURS };
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
    skippedDates,
  };
}
