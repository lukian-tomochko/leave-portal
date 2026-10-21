import type { ExistingRecord, LeaveRecordView, LeaveType, PlannedRecord, Position } from "./types";

// Порт доступу до даних: домен не знає про Supabase. Адаптер — supabase-repository.ts; у тестах — фейк у пам'яті.
export type NewRequest = {
  leaveType: LeaveType;
  records: PlannedRecord[];
  relationship?: string;
  comment?: string;
};

// База відхилила заявку обмеженням виключення (перетин у часі) — гонка двох одночасних заявок: застосунок
// перевірив перетин наперед, але між перевіркою й записом з'явився конфліктний запис. Заявка не створена.
export class LeaveConflictError extends Error {
  constructor() {
    super("leave record overlaps an existing one");
    this.name = "LeaveConflictError";
  }
}

export interface LeaveRepository {
  // Посади працівника з розкладом (під RLS бачить лише власні).
  loadPositions(employeeId: string): Promise<Position[]>;
  // Записи працівника, що блокують перетин (статуси «Awaiting decision», «Returned for revision», «Approved»).
  loadExistingRecords(employeeId: string): Promise<ExistingRecord[]>;
  // Заявка й усі її записи створюються атомарно (одна функція Postgres); повертає id заявки.
  // Кидає LeaveConflictError, якщо базу відхилила заявку через перетин.
  createRequest(request: NewRequest): Promise<string>;
  // Записи працівника для «My requests» (під RLS — лише власні), найновіші дати першими.
  listRecords(employeeId: string): Promise<LeaveRecordView[]>;
}
