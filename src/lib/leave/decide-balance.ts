import { type BalanceInputs, BalanceDeniedError, approvalSnapshot, planApproval } from "./balance";
import {
  type Actor,
  type DecideOutcome,
  type Decision,
  type DecisionRepository,
  NOT_ALLOWED,
  decideRecord,
} from "./decision";

// Рішення менеджера з урахуванням балансу (вимога 03): схвалення запису "Personal leave", що перевищує баланс, можливе лише з
// розподілом (AC-BALANCE-16); розподіл зберігається при схваленні (AC-BALANCE-10, AC-BALANCE-19). При схваленні будь-якого
// запису, що чекає рішення, фіксується й знімок частки дня за календарем цього моменту (AC-CAL-20). Інші рішення — як у decideRecord.
// Вхідні дані балансу доступні тому, хто має право їх бачити (employee_balance_inputs); відмова — як FORBIDDEN.
export async function decideWithBalance(
  repository: DecisionRepository,
  loadInputs: (employeeId: string) => Promise<BalanceInputs>,
  actor: Actor,
  recordId: string,
  decision: Decision,
  comment: string | undefined,
  withSplit: boolean,
): Promise<DecideOutcome> {
  if (decision !== "approved") {
    return decideRecord(repository, recordId, decision, comment);
  }

  const record = await repository.getRecord(actor, recordId);
  if (!record) {
    return { ok: false, code: "FORBIDDEN", message: NOT_ALLOWED };
  }

  // Вхідні дані потрібні для запису, що чекає рішення: знімок частки дня (усі типи, AC-CAL-20) і розподіл ("Personal leave");
  // статус решти перевіряє decideRecord через базу.
  if (record.status !== "awaiting_decision") {
    return decideRecord(repository, recordId, decision, comment);
  }

  let inputs: BalanceInputs;
  try {
    inputs = await loadInputs(record.employeeId);
  } catch (error) {
    if (error instanceof BalanceDeniedError) {
      return { ok: false, code: "FORBIDDEN", message: NOT_ALLOWED };
    }
    throw error;
  }

  const forDecision = {
    leaveType: record.leaveType,
    positionId: record.positionId,
    date: record.date,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
  };
  const snapshot = approvalSnapshot(inputs, forDecision) ?? undefined;
  // Розподіл потрібен лише для "Personal leave" понад залишок (AC-BALANCE-16); інші типи йдуть без розподілу.
  const plan = record.leaveType === "personal" ? planApproval(inputs, forDecision, withSplit) : null;
  if (plan && !plan.ok) {
    return { ok: false, code: "SPLIT_REQUIRED", message: plan.message };
  }
  const split = plan?.ok && plan.unpaidCents > 0 ? { paidCents: plan.paidCents, unpaidCents: plan.unpaidCents } : undefined;
  return decideRecord(repository, recordId, decision, comment, split, snapshot);
}
