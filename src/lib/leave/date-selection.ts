import { addDays, daysBetween } from "./dashboard";

// Вибір дат у календарі форми «Нова заявка»: клік додає чи прибирає один день, а другий клік після «якоря» додає весь діапазон.
// Чисті функції без React: тестуються без браузера. Список дат форми може містити порожній рядок (незаповнене поле) — його
// прибираємо, коли з'являються справжні дати, і повертаємо, якщо дат не лишилось.

// Усі дати від a до b включно (в будь-якому порядку), за зростанням.
export function expandRange(a: string, b: string): string[] {
  const [from, to] = a <= b ? [a, b] : [b, a];
  return Array.from({ length: daysBetween(from, to) + 1 }, (_, index) => addDays(from, index));
}

const withPlaceholder = (dates: string[]): string[] => (dates.length === 0 ? [""] : dates);

export type Selection = { dates: string[]; anchor: string | null };

// Клік по дню. Без якоря: день уже вибрано — прибираємо його, інакше додаємо й робимо якорем. З якорем: клік по тому самому дню
// скидає якір, по іншому — додає діапазон (лише дні, які приймає `isWorking`) і скидає якір.
export function clickDay(current: string[], anchor: string | null, day: string, isWorking: (date: string) => boolean): Selection {
  const dates = current.filter((date) => date !== "");
  if (anchor === null) {
    return dates.includes(day)
      ? { dates: withPlaceholder(dates.filter((date) => date !== day)), anchor: null }
      : { dates: [...dates, day], anchor: day };
  }
  if (anchor === day) {
    return { dates: withPlaceholder(dates), anchor: null };
  }
  const added = expandRange(anchor, day).filter((date) => date === day || isWorking(date));
  return { dates: [...new Set([...dates, ...added])], anchor: null };
}
