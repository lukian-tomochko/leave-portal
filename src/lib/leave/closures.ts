import { formatTime, parseTime } from "./time";
import type { ScheduleBlock } from "./types";

// Закриття шкільного календаря (вимога 04): чисті функції без залежностей від бази й Next.js.
// closedFrom = null — закриті цілі дні startsOn…endsOn включно; інакше це скорочений день: одна дата, школа закрита від часу.
export type Closure = {
  name: string;
  startsOn: string; // "YYYY-MM-DD"
  endsOn: string;
  closedFrom: string | null; // "HH:MM"
};

// Закриття, що покриває дату (дати "YYYY-MM-DD" порівнюються як рядки). Два закриття не мають спільної дати (AC-CAL-11).
export function closureOn(closures: Closure[], date: string): Closure | undefined {
  return closures.find((closure) => closure.startsOn <= date && date <= closure.endsOn);
}

// Блоки розкладу без закритої частини дня. Цілий день закритий — жодного блоку; скорочений день — блоки, що починаються
// до часу закриття, і блок, що триває в цей час, закінчується в цей час (AC-CAL-04, AC-CAL-05).
export function openBlocks(blocks: ScheduleBlock[], closure: Closure | undefined): ScheduleBlock[] {
  if (!closure) {
    return blocks;
  }
  if (closure.closedFrom === null) {
    return [];
  }
  const cut = parseTime(closure.closedFrom);
  return blocks
    .filter((block) => parseTime(block.startsAt) < cut)
    .map((block) => (parseTime(block.endsAt) > cut ? { ...block, endsAt: formatTime(cut) } : block));
}

// Закриття навчального року `year` (з 1 вересня `year` до 31 серпня `year + 1`): перетин діапазону з вікном року, тож закриття
// через 31.08 потрапляє в обидва роки (AC-CAL-02). Упорядковано за датою початку.
export function closuresInSchoolYear(closures: Closure[], year: number): Closure[] {
  const from = `${year}-09-01`;
  const to = `${year + 1}-08-31`;
  return closures.filter((closure) => closure.startsOn <= to && closure.endsOn >= from).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

// Дати закриття для списку: цілі дні — «2026-12-28 – 2027-01-08» (один день — «2026-11-20»), скорочений день — «2026-11-20 з 12:00».
export function describeClosure(closure: Closure): string {
  if (closure.closedFrom !== null) {
    return `${closure.startsOn} з ${closure.closedFrom}`;
  }
  return closure.startsOn === closure.endsOn ? closure.startsOn : `${closure.startsOn} – ${closure.endsOn}`;
}

// Навчальний рік із параметра `?year=`: ціле 2000–2100, інакше `fallback` (поточний навчальний рік).
export function parseSchoolYear(value: string | string[] | undefined, fallback: number): number {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text || !/^\d{4}$/.test(text)) {
    return fallback;
  }
  const year = Number(text);
  return year >= 2000 && year <= 2100 ? year : fallback;
}
