import type { LeaveRecordView, LeaveType, PlannedRecord, Position } from "./types";

// Порт доступу до даних: домен не знає про Supabase. Адаптер — supabase-repository.ts; у тестах — фейк у пам'яті.
export type NewRequest = {
  leaveType: LeaveType;
  records: PlannedRecord[];
  relationship?: string;
  comment?: string;
};

export interface LeaveRepository {
  // Посади працівника з розкладом (під RLS бачить лише власні).
  loadPositions(employeeId: string): Promise<Position[]>;
  // Заявка й усі її записи створюються атомарно (одна функція Postgres); повертає id заявки.
  createRequest(request: NewRequest): Promise<string>;
  // Записи працівника для «My requests» (під RLS — лише власні), найновіші дати першими.
  listRecords(employeeId: string): Promise<LeaveRecordView[]>;
}
