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
