// Типи доменного модуля заявок на відпустку (вимога 01). Без залежностей від бази й від Next.js:
// усе в цьому каталозі — чисті функції, які тестуються без мережі (див. openspec/changes/impl-leave-management/design.md, D4).
//
// Час — цивільна дата («2026-11-02») і локальний час («08:30») за Києвом: перерахунку поясів немає.

export const LEAVE_TYPES = ["sick", "personal", "unpaid", "family"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

// Спорідненість для "Family celebration" (requirements/01-leave-request.md, AC-LEAVE-12).
export const RELATIONSHIPS = ["sibling", "child", "parent", "grandchild", "grandparent"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

// Найбільша довжина коментаря до заявки, у символах (припущення PM, AC-LEAVE-18).
export const COMMENT_MAX_LENGTH = 500;

export const RECORD_STATUSES = [
  "awaiting_decision",
  "approved",
  "rejected",
  "returned_for_revision",
  "cancelled",
] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export type PositionKind = "main" | "additional";

// Блок розкладу: weekday 1 (пн) … 7 (нд); блок включає початок і не включає кінець.
export type ScheduleBlock = {
  weekday: number;
  startsAt: string; // "HH:MM"
  endsAt: string; // "HH:MM"
};

export type Position = {
  id: string;
  kind: PositionKind;
  division: string;
  jobTitle: string;
  blocks: ScheduleBlock[];
};

// Запис відпустки, який буде створено: одна посада, одна дата, конкретні години.
export type PlannedRecord = {
  positionId: string;
  date: string; // "YYYY-MM-DD"
  startsAt: string;
  endsAt: string;
  minutes: number; // тривалість лише в межах блоків розкладу
  status: RecordStatus;
  // Коментар заявки на кожному її записі (AC-LEAVE-17); у базі він лежить у leave_requests.
  comment?: string;
};

// Години відпустки в межах розкладу. Без них заявка — «цілий день». Поки що години однакові для всіх обраних
// дат і посад; окремі години для кожної посади — за потреби в задачі 3.
export type HoursInput = {
  startsAt: string; // "HH:MM"
  endsAt: string; // "HH:MM"
};

export type RequestInput = {
  leaveType: LeaveType;
  dates: string[];
  positionIds: string[];
  hours?: HoursInput;
  relationship?: Relationship; // обов'язкова для "family"
  comment?: string; // необов'язковий, до 500 символів
};

// Наявний запис працівника, з яким порівнюємо нові записи на перетин у часі.
export type ExistingRecord = {
  positionId: string;
  date: string; // "YYYY-MM-DD"
  startsAt: string;
  endsAt: string;
  status: RecordStatus;
};

export type PlanContext = {
  positions: Position[];
  // Записи працівника для перевірки перетинів; без них перетини не перевіряються.
  existing?: ExistingRecord[];
};

export type PlanErrorCode =
  | "NO_POSITION_CHOSEN"
  | "NO_WORKING_HOURS"
  | "HOURS_OUTSIDE_SCHEDULE"
  | "START_AT_BLOCK_END"
  | "END_NOT_AFTER_START"
  | "RELATIONSHIP_REQUIRED"
  | "COMMENT_TOO_LONG"
  | "TIME_CONFLICT"
  | "INVALID_INPUT";

export type PlanResult =
  | {
      ok: true;
      leaveType: LeaveType;
      records: PlannedRecord[];
      relationship?: Relationship;
      comment?: string;
      // Дати без робочих годин, які не прийнято (AC-LEAVE-21); решта дат заявки створюється.
      skippedDates: string[];
    }
  | { ok: false; code: PlanErrorCode; message: string };

// Рядок списку «My requests».
export type LeaveRecordView = {
  id: string;
  employeeId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  status: RecordStatus;
  leaveType: LeaveType;
  positionLabel: string;
  comment: string | null;
  // Коментар менеджера з останнього рішення, де він був (AC-DECIDE-05, AC-DECIDE-23, AC-DECIDE-24).
  managerComment: string | null;
};
