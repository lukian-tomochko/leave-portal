// Тексти для користувача — дослівно з вимог PM (requirements/01-leave-request.md). Нових текстів не вигадуємо:
// якщо PM тексту не дав, дія повертає технічний код, а інтерфейс показує нейтральну фразу.
import { parseTime } from "./time";
import type { LeaveType, RecordStatus, ScheduleBlock } from "./types";

// AC-LEAVE-06
export const NO_WORKING_HOURS = "You have no working hours on this day";
// AC-LEAVE-10
export const CHOOSE_AT_LEAST_ONE_POSITION = "Choose at least one position";
// AC-LEAVE-09
export const END_MUST_BE_LATER = "The end must be later than the start";

// AC-LEAVE-07, AC-LEAVE-19: перелік усіх блоків дня за часом початку, через ", ".
// Для одного блоку виходить текст AC-LEAVE-07: "Hours must be within your schedule: 08:30–13:00".
export function hoursOutsideSchedule(blocks: ScheduleBlock[]): string {
  const list = [...blocks]
    .sort((a, b) => parseTime(a.startsAt) - parseTime(b.startsAt))
    .map((block) => `${block.startsAt}–${block.endsAt}`)
    .join(", ");
  return `Hours must be within your schedule: ${list}`;
}

// AC-LEAVE-08, AC-LEAVE-20
export function startAtBlockEnd(time: string): string {
  return `${time} is the end of working time and can only be chosen as the end of leave`;
}

// AC-LEAVE-12
export const RELATIONSHIP_REQUIRED =
  "State your relationship to this person: sibling, child, parent, grandchild or grandparent. Not applicable to cousins, friends, neighbours or siblings-in-law";
// AC-LEAVE-18
export const COMMENT_TOO_LONG = "The comment can be at most 500 characters";

// AC-LEAVE-13, AC-LEAVE-16: дата й години наявного запису, з яким є перетин.
export function alreadyHaveRequest(record: { date: string; startsAt: string; endsAt: string }): string {
  return `You already have a request for this time: ${record.date} ${record.startsAt}–${record.endsAt}`;
}

// ── Вимога 02: рішення менеджера (requirements/02-leave-decision.md) ───────────
// AC-DECIDE-04
export const TELL_EMPLOYEE_WHAT_TO_FIX = "Tell the employee what to fix";
// AC-DECIDE-14
export const NO_RECORDS_AWAITING_DECISION = "No records awaiting decision";
// AC-DECIDE-18
export const OWN_RECORD_DECIDED_BY_ADMIN = "Your own record is decided by an administrator";

// AC-DECIDE-07: інший менеджер уже ухвалив рішення; статус — із глосарія PM.
export function anotherManagerDecided(status: RecordStatus): string {
  return `Another manager has already decided: ${STATUS_LABELS[status]}`;
}

// AC-DECIDE-12
export const ALREADY_APPROVED = "This record is already approved and cannot be changed";
// AC-DECIDE-21
export const ONLY_HOURS_CAN_BE_CHANGED =
  "Only the hours can be changed. To change the date, position or leave type, cancel this record and submit a new request";

// Підписи статусів і типів — із глосарія PM (requirements/product.md).
export const STATUS_LABELS: Record<RecordStatus, string> = {
  awaiting_decision: "Awaiting decision",
  approved: "Approved",
  rejected: "Rejected",
  returned_for_revision: "Returned for revision",
  cancelled: "Cancelled",
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick: "Sick leave",
  personal: "Personal leave",
  unpaid: "Unpaid leave",
  family: "Family celebration",
};
