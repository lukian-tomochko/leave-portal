// Тексти для користувача — дослівно з вимог PM (requirements/01-leave-request.md). Нових текстів не вигадуємо:
// якщо PM тексту не дав, дія повертає технічний код, а інтерфейс показує нейтральну фразу.
import type { LeaveType, RecordStatus } from "./types";

// AC-LEAVE-06
export const NO_WORKING_HOURS = "You have no working hours on this day";
// AC-LEAVE-10
export const CHOOSE_AT_LEAST_ONE_POSITION = "Choose at least one position";

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
