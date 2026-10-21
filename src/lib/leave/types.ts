// Типи доменного модуля заявок на відпустку (вимога 01). Без залежностей від бази й від Next.js:
// усе в цьому каталозі — чисті функції, які тестуються без мережі (див. openspec/changes/impl-leave-management/design.md, D4).
//
// Час — цивільна дата («2026-11-02») і локальний час («08:30») за Києвом: перерахунку поясів немає.

export const LEAVE_TYPES = ["sick", "personal", "unpaid", "family"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

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
};

export type PlanContext = {
  positions: Position[];
};

export type PlanErrorCode =
  | "NO_POSITION_CHOSEN"
  | "NO_WORKING_HOURS"
  | "HOURS_OUTSIDE_SCHEDULE"
  | "START_AT_BLOCK_END"
  | "END_NOT_AFTER_START"
  | "INVALID_INPUT";

export type PlanResult =
  | { ok: true; leaveType: LeaveType; records: PlannedRecord[] }
  | { ok: false; code: PlanErrorCode; message: string };

// Рядок списку «My requests».
export type LeaveRecordView = {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  status: RecordStatus;
  leaveType: LeaveType;
  positionLabel: string;
};
