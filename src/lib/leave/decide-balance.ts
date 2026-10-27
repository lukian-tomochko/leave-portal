import { type BalanceInputs, BalanceDeniedError, planApproval } from "./balance";
import {
  type Actor,
  type DecideOutcome,
  type Decision,
  type DecisionRepository,
  NOT_ALLOWED,
  decideRecord,
} from "./decision";

// Рішення менеджера з урахуванням балансу (вимога 03): схвалення запису "Personal leave", що перевищує баланс, можливе лише з
// розподілом (AC-BALANCE-16); розподіл зберігається при схваленні (AC-BALANCE-10, AC-BALANCE-19). Інші рішення — як у decideRecord.
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

  let inputs: BalanceInputs;
  try {
    inputs = await loadInputs(record.employeeId);
  } catch (error) {
    if (error instanceof BalanceDeniedError) {
      return { ok: false, code: "FORBIDDEN", message: NOT_ALLOWED };
    }
    throw error;
  }

  const plan = planApproval(
    inputs,
    {
      leaveType: record.leaveType,
      positionId: record.positionId,
      date: record.date,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
    },
    withSplit,
  );
  if (!plan.ok) {
    return { ok: false, code: "SPLIT_REQUIRED", message: plan.message };
  }
  const split = plan.unpaidCents > 0 ? { paidCents: plan.paidCents, unpaidCents: plan.unpaidCents } : undefined;
  return decideRecord(repository, recordId, decision, comment, split);
}
