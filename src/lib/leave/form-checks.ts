import { closureOn, type Closure } from "./closures";
import { CHOOSE_AT_LEAST_ONE_POSITION, HOURS_STEP_INVALID, NO_WORKING_HOURS, schoolClosedOn } from "./messages";
import { isValidDate, weekdayOf } from "./time";

// Перевірки форми «Нова заявка» до запиту на сервер. Окремі чисті функції з тестами: форма й planRequest дають
// користувачеві ті самі тексти PM (AC-LEAVE-06, AC-LEAVE-10).

export type FormPosition = { id: string; weekdays: number[] };

// Жодної обраної посади: повідомлення PM, а не «немає робочих годин» біля кожної дати (AC-LEAVE-10).
export function positionsError(selectedIds: string[]): string | null {
  return selectedIds.length === 0 ? CHOOSE_AT_LEAST_ONE_POSITION : null;
}

// Помилка біля дати: жодна з обраних посад не має розкладу в цей день тижня (AC-LEAVE-06) або день закритий (AC-CAL-03). Порожня чи некоректна дата
// помилки біля поля не дає (поле саме не пропустить її, а weekdayOf на ній кинув би виняток); коли не обрано жодної
// посади, текст дає positionsError, а не дата.
export function dateError(
  date: string,
  positions: FormPosition[],
  selectedIds: string[],
  closures: Closure[] = [],
): string | null {
  if (!date || !isValidDate(date) || selectedIds.length === 0) {
    return null;
  }
  const weekday = weekdayOf(date);
  const works = positions.some((position) => selectedIds.includes(position.id) && position.weekdays.includes(weekday));
  if (!works) {
    return NO_WORKING_HOURS;
  }
  // Закриті цілі дні шкільного календаря не приймаються одразу після вибору (AC-CAL-03). Скорочений день форма не відхиляє:
  // чи лишились відкриті блоки, знає сервер (planRequest), він і покаже повідомлення в підсумку.
  const closure = closureOn(closures, date);
  return closure && closure.closedFrom === null ? schoolClosedOn(closure.name) : null;
}

// Години з кроком 5 хвилин: сервер інакше відповів би загальною технічною помилкою. Порожній час чи не-«HH:MM» не оцінюємо
// (поле саме вимагає значення); повертає підказку, якщо хвилини початку чи кінця не кратні 5.
export function hoursStepError(startsAt: string, endsAt: string): string | null {
  const minutes = [startsAt, endsAt].map((value) => /^\d{2}:(\d{2})$/.exec(value)?.[1]).filter((value) => value !== undefined);
  return minutes.some((value) => Number(value) % 5 !== 0) ? HOURS_STEP_INVALID : null;
}
