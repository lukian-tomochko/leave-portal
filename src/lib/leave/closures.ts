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
