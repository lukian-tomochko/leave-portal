import { LeaveConflictError, type LeaveRepository } from "./repository";
import { planRequest } from "./request";
import type { LeaveRecordView, LeaveType, PlanErrorCode, PlannedRecord, Position, RequestInput } from "./types";

// Сценарії над портом LeaveRepository: тестуються без бази (фейк у пам'яті), а server actions лише викликають їх.

export type Failure = { ok: false; code: PlanErrorCode; message: string };

export type PreviewOutcome =
  | { ok: true; leaveType: LeaveType; records: PlannedRecord[]; positions: Position[]; comment?: string }
  | Failure;

export type SubmitOutcome = { ok: true; requestId: string } | Failure;

// Підсумок перед підтвердженням: лише читає й перевіряє. Нічого не створює, тому до підтвердження жодного запису
// немає, а введені значення повертає викликач (AC-LEAVE-11).
export async function previewRequest(
  repository: LeaveRepository,
  employeeId: string,
  input: RequestInput,
): Promise<PreviewOutcome> {
  const positions = await repository.loadPositions(employeeId);
  const existing = await repository.loadExistingRecords(employeeId);

  const plan = planRequest(input, { positions, existing });
  if (!plan.ok) {
    return plan;
  }
  return { ok: true, leaveType: plan.leaveType, records: plan.records, positions, comment: plan.comment };
}

// «My requests»: записи лише цього працівника. RLS уже обмежує вибірку, але домен не покладається на це сам:
// чужі записи, що випадково потрапили б у відповідь репозиторію, відкидаємо (AC-LEAVE-14).
export async function listMyRecords(repository: LeaveRepository, employeeId: string): Promise<LeaveRecordView[]> {
  const records = await repository.listRecords(employeeId);
  return records.filter((record) => record.employeeId === employeeId);
}

// Створення заявки: усе перевіряємо наново (значенням із форми підтвердження не довіряємо) і створюємо заявку з
// усіма записами одним викликом (AC-LEAVE-05, AC-LEAVE-16). Якщо база відхилила її через гонку перетинів, плануємо
// ще раз із свіжими записами, щоб показати людині повідомлення PM з конкретним конфліктним записом.
export async function submitRequest(
  repository: LeaveRepository,
  employeeId: string,
  input: RequestInput,
): Promise<SubmitOutcome> {
  const positions = await repository.loadPositions(employeeId);
  const existing = await repository.loadExistingRecords(employeeId);

  const plan = planRequest(input, { positions, existing });
  if (!plan.ok) {
    return plan;
  }

  try {
    const requestId = await repository.createRequest({
      leaveType: plan.leaveType,
      records: plan.records,
      relationship: plan.relationship,
      comment: plan.comment,
    });
    return { ok: true, requestId };
  } catch (error) {
    if (!(error instanceof LeaveConflictError)) {
      throw error;
    }
    const fresh = await repository.loadExistingRecords(employeeId);
    const replan = planRequest(input, { positions, existing: fresh });
    return replan.ok ? { ok: false, code: "INVALID_INPUT", message: "Invalid request" } : replan;
  }
}
