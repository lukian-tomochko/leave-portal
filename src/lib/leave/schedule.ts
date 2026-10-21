import { parseTime, weekdayOf } from "./time";
import type { Position, ScheduleBlock } from "./types";

// Блоки розкладу посади на дату, за часом початку.
export function blocksOn(position: Position, date: string): ScheduleBlock[] {
  const weekday = weekdayOf(date);
  return position.blocks
    .filter((block) => block.weekday === weekday)
    .sort((a, b) => parseTime(a.startsAt) - parseTime(b.startsAt));
}

// «Цілий день» посади — усі блоки розкладу на цю дату: від початку першого до кінця останнього.
// Тривалість рахуємо лише в межах блоків: проміжок між блоками не входить (AC-LEAVE-15).
export function wholeDay(blocks: ScheduleBlock[]): { startsAt: string; endsAt: string; minutes: number } {
  if (blocks.length === 0) {
    throw new RangeError("wholeDay needs at least one block");
  }
  const minutes = blocks.reduce((sum, block) => sum + (parseTime(block.endsAt) - parseTime(block.startsAt)), 0);
  return {
    startsAt: blocks[0].startsAt,
    endsAt: blocks[blocks.length - 1].endsAt,
    minutes,
  };
}

// Підпис посади, як у прикладах PM: "Elementary school / Teacher".
export function positionLabel(position: Pick<Position, "division" | "jobTitle">): string {
  return `${position.division} / ${position.jobTitle}`;
}
