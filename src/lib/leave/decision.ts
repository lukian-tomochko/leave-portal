import {
  NO_RECORDS_AWAITING_DECISION,
  OWN_RECORD_DECIDED_BY_ADMIN,
  STATUS_LABELS,
  TELL_EMPLOYEE_WHAT_TO_FIX,
  anotherManagerDecided,
} from "./messages";
import type { LeaveType, RecordStatus } from "./types";

// Домен рішення менеджера (вимога 02, AC-DECIDE-01…20): без залежностей від бази й Next.js, тестується з фейком
// порту DecisionRepository. Права тримає база (функції decide_leave_record, RLS); домен лише перевіряє ввід,
// відкидає чуже (захисний фільтр) і перетворює відповіді бази на тексти PM.
// Рішення — docs/decisions/0004-decision-functions.md і openspec/changes/impl-leave-decision/design.md.

export const DECISIONS = ["approved", "rejected", "returned_for_revision"] as const;
export type Decision = (typeof DECISIONS)[number];

export type ActorRole = "employee" | "manager" | "admin";

// Хто діє: id, роль із profiles і посади, за які відповідає (для менеджера).
export type Actor = {
  id: string;
  role: ActorRole;
  managedPositionIds: string[];
};

// Один рядок історії запису (AC-DECIDE-10, AC-DECIDE-15).
export type DecisionEntry = {
  decidedAt: string; // ISO-час із бази
  decidedByName: string;
  decision: Decision;
  comment: string | null;
};

// Запис у списках і на сторінці запису.
export type DecisionRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  positionId: string;
  positionLabel: string;
  date: string; // "YYYY-MM-DD"
  startsAt: string;
  endsAt: string;
  leaveType: LeaveType;
  status: RecordStatus;
  requestComment: string | null; // коментар працівника до заявки (AC-DECIDE-20)
  entries: DecisionEntry[];
};

export type DecideResult = { ok: boolean; status: RecordStatus };

// База відмовила за правами: "own_record" — менеджер вирішує власний запис (AC-DECIDE-18); "forbidden" — немає ролі,
// запис не видно чи менеджер не відповідає за посаду (AC-DECIDE-08, AC-DECIDE-09).
export class DecisionDeniedError extends Error {
  readonly reason: "own_record" | "forbidden";

  constructor(reason: "own_record" | "forbidden") {
    super(`decision denied: ${reason}`);
    this.name = "DecisionDeniedError";
    this.reason = reason;
  }
}

// Порт доступу до даних; адаптер — supabase-decision-repository.ts.
export interface DecisionRepository {
  // Записи, які бачить користувач і за які він відповідає (менеджер — свої посади, адміністратор — усі).
  listRecords(actor: Actor): Promise<DecisionRecord[]>;
  // Один запис, якщо користувач його бачить (під RLS), інакше null.
  getRecord(actor: Actor, recordId: string): Promise<DecisionRecord | null>;
  // Рішення однією функцією бази; кидає DecisionDeniedError, коли база відмовила за правами.
  decide(recordId: string, decision: Decision, comment: string | null): Promise<DecideResult>;
}

export type DecideOutcome =
  | { ok: true; status: RecordStatus }
  | { ok: false; code: "COMMENT_REQUIRED" | "ALREADY_DECIDED" | "OWN_RECORD" | "FORBIDDEN"; message: string };

// Нейтральна фраза для випадків, де PM тексту не дав (скасований запис, відмова за правами): нових правил не вигадуємо.
export const NOT_ALLOWED = "Недостатньо прав або запис змінився. Оновіть сторінку.";
export const RECORD_CANCELLED = "Запис скасовано працівником.";

export function isDecision(value: unknown): value is Decision {
  return typeof value === "string" && (DECISIONS as readonly string[]).includes(value);
}

export function isDecider(role: ActorRole): boolean {
  return role === "manager" || role === "admin";
}

// Записи для рішення. База вже віддає лише дозволене; домен не покладається на це сам і відкидає чуже:
// менеджеру — лише записи посад, за які він відповідає (AC-DECIDE-01), адміністратору — усі, іншим — нічого.
function inScope(actor: Actor, record: DecisionRecord): boolean {
  if (actor.role === "admin") {
    return true;
  }
  return actor.role === "manager" && actor.managedPositionIds.includes(record.positionId);
}

// Список «Awaiting decision» (AC-DECIDE-01, AC-DECIDE-11, AC-DECIDE-14), найближчі дати першими.
export async function listAwaiting(repository: DecisionRepository, actor: Actor): Promise<DecisionRecord[]> {
  const records = await repository.listRecords(actor);
  return records
    .filter((record) => inScope(actor, record) && record.status === "awaiting_decision")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt));
}

// «History»: записи тих самих посад, які вже не чекають рішення (AC-DECIDE-11), найновіші дати першими.
export async function listHistory(repository: DecisionRepository, actor: Actor): Promise<DecisionRecord[]> {
  const records = await repository.listRecords(actor);
  return records
    .filter((record) => inScope(actor, record) && record.status !== "awaiting_decision")
    .sort((a, b) => b.date.localeCompare(a.date) || b.startsAt.localeCompare(a.startsAt));
}

// Текст порожнього стану «Awaiting decision» (AC-DECIDE-14); для непорожнього списку — null.
export function awaitingEmptyMessage(records: DecisionRecord[]): string | null {
  return records.length === 0 ? NO_RECORDS_AWAITING_DECISION : null;
}

// Запис для сторінки: власник або відповідальний менеджер бачать його під RLS; адміністратор — будь-який.
export async function getRecord(
  repository: DecisionRepository,
  actor: Actor,
  recordId: string,
): Promise<DecisionRecord | null> {
  return repository.getRecord(actor, recordId);
}

// Рішення. Повернення без коментаря база теж відхиляє, але текст PM показуємо з домену (AC-DECIDE-04).
export async function decideRecord(
  repository: DecisionRepository,
  recordId: string,
  decision: Decision,
  comment?: string,
): Promise<DecideOutcome> {
  const text = comment?.trim() ? comment.trim() : null;
  if (decision === "returned_for_revision" && text === null) {
    return { ok: false, code: "COMMENT_REQUIRED", message: TELL_EMPLOYEE_WHAT_TO_FIX };
  }

  let result: DecideResult;
  try {
    result = await repository.decide(recordId, decision, text);
  } catch (error) {
    if (error instanceof DecisionDeniedError) {
      return error.reason === "own_record"
        ? { ok: false, code: "OWN_RECORD", message: OWN_RECORD_DECIDED_BY_ADMIN }
        : { ok: false, code: "FORBIDDEN", message: NOT_ALLOWED };
    }
    throw error;
  }

  if (result.ok) {
    return { ok: true, status: result.status };
  }
  // Запис уже не чекає рішення. Текст PM є для рішень інших менеджерів; для скасованого працівником — нейтральна фраза.
  return result.status === "cancelled"
    ? { ok: false, code: "ALREADY_DECIDED", message: RECORD_CANCELLED }
    : { ok: false, code: "ALREADY_DECIDED", message: anotherManagerDecided(result.status) };
}

const DECISION_LABELS: Record<Decision, string> = {
  approved: STATUS_LABELS.approved,
  rejected: STATUS_LABELS.rejected,
  returned_for_revision: STATUS_LABELS.returned_for_revision,
};

// Дата й час рішення за Києвом, до хвилини: "2026-11-02 09:15" (припущення PM).
export function formatDecisionTime(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Kyiv",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

// Рядок історії (AC-DECIDE-15): дата й час, хто вирішив, рішення.
export function formatDecisionLine(entry: DecisionEntry): string {
  return `${formatDecisionTime(entry.decidedAt)} · ${entry.decidedByName} · ${DECISION_LABELS[entry.decision]}`;
}
