import type { Closure } from "./closures";
import {
  CLOSURE_ALREADY_REMOVED,
  CLOSURE_DATE_INVALID,
  CLOSURE_NAME_REQUIRED,
  CLOSURE_NAME_TOO_LONG,
  CLOSURE_TECHNICAL_ERROR,
  CLOSURE_TIME_INVALID,
  END_BEFORE_START,
  alreadyClosed,
  closureBlocked,
} from "./messages";
import { isValidDate, parseTime } from "./time";

// Керування шкільним календарем (вимога 04, адміністратор): чиста перевірка форми й переклад відповідей функцій бази
// add_school_closure / remove_school_closure на тексти повідомлень. Права й бізнес-правила остаточно тримає база
// (AC-CAL-07, 08, 11, 13); перевірка форми тут — лише швидка відмова без запиту.

export type ClosureFormValues = {
  kind: string; // "whole" — цілі дні, "early" — скорочений день
  name: string;
  startsOn: string;
  endsOn: string;
  date: string; // скорочений день: одна дата
  time: string; // скорочений день: час закриття
};

export type ParsedClosure = { ok: true; input: Closure } | { ok: false; message: string };

const NAME_MAX = 100;

export function parseClosureForm(values: ClosureFormValues): ParsedClosure {
  const name = values.name.trim();
  if (name === "") {
    return { ok: false, message: CLOSURE_NAME_REQUIRED };
  }
  if (name.length > NAME_MAX) {
    return { ok: false, message: CLOSURE_NAME_TOO_LONG };
  }

  if (values.kind === "early") {
    if (!isValidDate(values.date)) {
      return { ok: false, message: CLOSURE_DATE_INVALID };
    }
    // Час закриття — після 00:00 з кроком 5 хвилин (як обмеження таблиці school_closures).
    if (!/^\d{2}:\d{2}$/.test(values.time)) {
      return { ok: false, message: CLOSURE_TIME_INVALID };
    }
    let minutes: number;
    try {
      minutes = parseTime(values.time);
    } catch {
      return { ok: false, message: CLOSURE_TIME_INVALID };
    }
    if (minutes === 0 || minutes % 5 !== 0) {
      return { ok: false, message: CLOSURE_TIME_INVALID };
    }
    return { ok: true, input: { name, startsOn: values.date, endsOn: values.date, closedFrom: values.time } };
  }

  if (!isValidDate(values.startsOn) || !isValidDate(values.endsOn)) {
    return { ok: false, message: CLOSURE_DATE_INVALID };
  }
  // Дати "YYYY-MM-DD" порівнюються як рядки (AC-CAL-10).
  if (values.endsOn < values.startsOn) {
    return { ok: false, message: END_BEFORE_START };
  }
  return { ok: true, input: { name, startsOn: values.startsOn, endsOn: values.endsOn, closedFrom: null } };
}

type Overlap = { date: string; name: string };
type Blocker = { date: string; email: string };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// Відповідь add_school_closure → повідомлення адміністратору; null — закриття збережено.
export function addClosureMessage(result: unknown): string | null {
  if (!isObject(result)) {
    return CLOSURE_TECHNICAL_ERROR;
  }
  if (result.ok === true) {
    return null;
  }
  switch (result.code) {
    case "name_empty":
      return CLOSURE_NAME_REQUIRED;
    case "name_too_long":
      return CLOSURE_NAME_TOO_LONG;
    case "end_before_start":
      return END_BEFORE_START;
    case "invalid_time":
      return CLOSURE_TIME_INVALID;
    case "overlap":
      return Array.isArray(result.overlaps) && result.overlaps.length > 0
        ? alreadyClosed(result.overlaps as Overlap[])
        : CLOSURE_TECHNICAL_ERROR;
    case "blocked":
      return Array.isArray(result.records) && result.records.length > 0
        ? closureBlocked(result.records as Blocker[])
        : CLOSURE_TECHNICAL_ERROR;
    default:
      return CLOSURE_TECHNICAL_ERROR;
  }
}

// Відповідь remove_school_closure → повідомлення; null — видалено.
export function removeClosureMessage(result: unknown): string | null {
  if (!isObject(result)) {
    return CLOSURE_TECHNICAL_ERROR;
  }
  if (result.ok === true) {
    return null;
  }
  return result.code === "not_found" ? CLOSURE_ALREADY_REMOVED : CLOSURE_TECHNICAL_ERROR;
}
