import { CHOOSE_AT_LEAST_ONE_POSITION, NO_WORKING_HOURS } from "./messages";
import { blocksOn, validateHours, wholeDay } from "./schedule";
import { isValidDate } from "./time";
import type { PlanContext, PlanResult, PlannedRecord, RequestInput } from "./types";
import { LEAVE_TYPES } from "./types";

const INVALID_INPUT = "Invalid request";

// Будує записи відпустки з даних форми, нічого не пишучи й не читаючи з бази (чиста функція).
// Результат — або всі записи, або помилка без жодного запису («все або нічого», AC-LEAVE-16).
//
// «Цілий день» (без hours) або години в межах розкладу (з hours); коментар і перетини додають наступні задачі плану.
// Порядок перевірок — рішення розробника (PM порядок не задав): посади → дата без годин → години.
export function planRequest(input: RequestInput, context: PlanContext): PlanResult {
  if (!LEAVE_TYPES.includes(input.leaveType) || input.dates.length === 0 || !input.dates.every(isValidDate)) {
    return { ok: false, code: "INVALID_INPUT", message: INVALID_INPUT };
  }

  if (input.positionIds.length === 0) {
    return { ok: false, code: "NO_POSITION_CHOSEN", message: CHOOSE_AT_LEAST_ONE_POSITION };
  }

  const records: PlannedRecord[] = [];
  const seen = new Set<string>();

  for (const date of input.dates) {
    for (const positionId of input.positionIds) {
      const key = `${date}|${positionId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      // Посада не з контексту працівника — це чужа чи вигадана посада, а не помилка користувача.
      const position = context.positions.find((p) => p.id === positionId);
      if (!position) {
        return { ok: false, code: "INVALID_INPUT", message: INVALID_INPUT };
      }

      const blocks = blocksOn(position, date);
      if (blocks.length === 0) {
        return { ok: false, code: "NO_WORKING_HOURS", message: NO_WORKING_HOURS };
      }

      if (input.hours) {
        const check = validateHours(blocks, input.hours.startsAt, input.hours.endsAt);
        if (!check.ok) {
          return { ok: false, code: check.code, message: check.message };
        }
        records.push({
          positionId,
          date,
          startsAt: input.hours.startsAt,
          endsAt: input.hours.endsAt,
          minutes: check.minutes,
          status: "awaiting_decision",
        });
        continue;
      }

      const day = wholeDay(blocks);
      records.push({
        positionId,
        date,
        startsAt: day.startsAt,
        endsAt: day.endsAt,
        minutes: day.minutes,
        status: "awaiting_decision",
      });
    }
  }

  return { ok: true, leaveType: input.leaveType, records };
}
