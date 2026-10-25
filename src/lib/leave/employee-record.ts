import { NOT_ALLOWED, type DecideResult } from "./decision";
import { ALREADY_APPROVED, ONLY_HOURS_CAN_BE_CHANGED, alreadyHaveRequest } from "./messages";
import { LeaveConflictError } from "./repository";
import { blocksOn, validateHours } from "./schedule";
import { parseTime } from "./time";
import type { LeaveType, Position, RecordStatus } from "./types";

// Домен змін працівником власного запису (вимога 02, AC-DECIDE-06, 12, 13, 16, 17, 21, 22): без залежностей від бази й
// Next.js, тестується з фейком порту EmployeeRecordRepository. Права тримає база (функції update_leave_record_hours і
// cancel_leave_record); домен перевіряє правила PM і перетворює відповіді бази на їхні тексти.
// Рішення — docs/decisions/0004-decision-functions.md і openspec/changes/impl-leave-decision/design.md (D5).

export type OwnRecord = {
  id: string;
  employeeId: string;
  positionId: string;
  date: string; // "YYYY-MM-DD"
  startsAt: string;
  endsAt: string;
  status: RecordStatus;
  leaveType: LeaveType;
};

// Запис із посадою (розклад) і іншими активними записами тієї ж посади на цю дату (без самого запису).
export type OwnRecordContext = {
  record: OwnRecord;
  position: Position;
  others: { date: string; startsAt: string; endsAt: string }[];
};

export interface EmployeeRecordRepository {
  // Власний запис працівника; чужий чи неіснуючий — null (під RLS іншого не видно).
  getOwnRecord(employeeId: string, recordId: string): Promise<OwnRecordContext | null>;
  // Зміна годин функцією бази; кидає LeaveConflictError, якщо базу відхилила зміну через перетин (гонка).
  updateHours(recordId: string, startsAt: string, endsAt: string): Promise<DecideResult>;
  cancel(recordId: string): Promise<DecideResult>;
}

export type ChangeInput = {
  recordId: string;
  startsAt: string;
  endsAt: string;
  // Те, що працівник намагався змінити понад години (прямий запит): будь-яка відмінність від запису — відмова.
  requested?: { leaveType?: string; date?: string; positionId?: string };
};

export type EmployeeOutcome =
  | { ok: true; status: RecordStatus }
  | {
      ok: false;
      code: "NOT_FOUND" | "ONLY_HOURS" | "ALREADY_APPROVED" | "NOT_EDITABLE" | "INVALID_HOURS" | "TIME_CONFLICT";
      message: string;
    };

// Нейтральна фраза, де PM тексту не дав (відхилений, скасований чи повернений запис без права змін): нових правил не вигадуємо.
export const RECORD_NOT_EDITABLE = "Цей запис уже не можна змінити.";

const EDITABLE: RecordStatus[] = ["awaiting_decision", "returned_for_revision"];

function statusRefusal(status: RecordStatus): EmployeeOutcome {
  return status === "approved"
    ? { ok: false, code: "ALREADY_APPROVED", message: ALREADY_APPROVED }
    : { ok: false, code: "NOT_EDITABLE", message: RECORD_NOT_EDITABLE };
}

const overlaps = (a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }) =>
  parseTime(a.startsAt) < parseTime(b.endsAt) && parseTime(b.startsAt) < parseTime(a.endsAt);

// Перевірки без запису: лише години, у межах розкладу, без перетину з іншими записами тієї ж посади
// (саме з собою запис не перевіряється, припущення PM).
function checkChange(context: OwnRecordContext, input: ChangeInput): EmployeeOutcome | null {
  const { record, position, others } = context;

  const requested = input.requested ?? {};
  if (
    (requested.leaveType !== undefined && requested.leaveType !== record.leaveType) ||
    (requested.date !== undefined && requested.date !== record.date) ||
    (requested.positionId !== undefined && requested.positionId !== record.positionId)
  ) {
    return { ok: false, code: "ONLY_HOURS", message: ONLY_HOURS_CAN_BE_CHANGED };
  }
  if (!EDITABLE.includes(record.status)) {
    return statusRefusal(record.status);
  }

  const hours = validateHours(blocksOn(position, record.date), input.startsAt, input.endsAt);
  if (!hours.ok) {
    return { ok: false, code: "INVALID_HOURS", message: hours.message };
  }
  const conflict = others.find((other) => overlaps(other, input));
  if (conflict) {
    return { ok: false, code: "TIME_CONFLICT", message: alreadyHaveRequest(conflict) };
  }
  return null;
}

// Зміна годин (AC-DECIDE-06, AC-DECIDE-16): запис лишається посадою й датою, зі «Returned for revision» повертається в
// «Awaiting decision» і знову потрапляє до тих самих менеджерів. Відмови: AC-DECIDE-12, 21, 22.
export async function changeHours(
  repository: EmployeeRecordRepository,
  employeeId: string,
  input: ChangeInput,
): Promise<EmployeeOutcome> {
  const context = await repository.getOwnRecord(employeeId, input.recordId);
  if (!context) {
    return { ok: false, code: "NOT_FOUND", message: NOT_ALLOWED };
  }
  const refusal = checkChange(context, input);
  if (refusal) {
    return refusal;
  }

  try {
    const result = await repository.updateHours(input.recordId, input.startsAt, input.endsAt);
    return result.ok ? { ok: true, status: result.status } : statusRefusal(result.status);
  } catch (error) {
    if (!(error instanceof LeaveConflictError)) {
      throw error;
    }
    // Гонка: між перевіркою й записом з'явився конфліктний запис. Перевіряємо ще раз зі свіжими даними.
    const fresh = await repository.getOwnRecord(employeeId, input.recordId);
    const replan = fresh ? checkChange(fresh, input) : null;
    return replan ?? { ok: false, code: "TIME_CONFLICT", message: NOT_ALLOWED };
  }
}

// Скасування власного запису зі статусом «Awaiting decision» чи «Returned for revision» (AC-DECIDE-13, AC-DECIDE-17).
export async function cancelRecord(
  repository: EmployeeRecordRepository,
  employeeId: string,
  recordId: string,
): Promise<EmployeeOutcome> {
  const context = await repository.getOwnRecord(employeeId, recordId);
  if (!context) {
    return { ok: false, code: "NOT_FOUND", message: NOT_ALLOWED };
  }
  if (!EDITABLE.includes(context.record.status)) {
    return statusRefusal(context.record.status);
  }
  const result = await repository.cancel(recordId);
  return result.ok ? { ok: true, status: result.status } : statusRefusal(result.status);
}
