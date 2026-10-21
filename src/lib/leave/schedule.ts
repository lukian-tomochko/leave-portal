import { END_MUST_BE_LATER, hoursOutsideSchedule, startAtBlockEnd } from "./messages";
import { formatTime, parseTime, weekdayOf } from "./time";
import type { PlanErrorCode, Position, ScheduleBlock } from "./types";

export type HoursCheck =
  | { ok: true; minutes: number }
  | { ok: false; code: Extract<PlanErrorCode, "HOURS_OUTSIDE_SCHEDULE" | "START_AT_BLOCK_END" | "END_NOT_AFTER_START" | "INVALID_INPUT">; message: string };

const INVALID_HOURS = { ok: false, code: "INVALID_INPUT", message: "Invalid request" } as const;

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

// Перевіряє години відпустки за блоками розкладу дня й рахує тривалість у хвилинах лише всередині блоків.
// Правила PM (Assumptions у вимозі 01): блок включає початок і не включає кінець; початок і кінець мають припадати на
// блок (кінець може збігатися з кінцем блоку); час — з точністю 5 хвилин.
// Порядок перевірок (за прикладами PM): початок → «кінець пізніше за початок» → кінець.
export function validateHours(blocks: ScheduleBlock[], startsAt: string, endsAt: string): HoursCheck {
  let start: number;
  let end: number;
  try {
    start = parseTime(startsAt);
    end = parseTime(endsAt);
  } catch {
    return INVALID_HOURS;
  }
  // PM текст для не кратного 5 хвилинам часу не давав: форма має крок 5 хв, а сюди такий час не доходить.
  if (start % 5 !== 0 || end % 5 !== 0) {
    return INVALID_HOURS;
  }

  const ranges = blocks.map((block) => ({ start: parseTime(block.startsAt), end: parseTime(block.endsAt) }));
  const outside = { ok: false, code: "HOURS_OUTSIDE_SCHEDULE", message: hoursOutsideSchedule(blocks) } as const;

  if (!ranges.some((r) => start >= r.start && start < r.end)) {
    // Початок збігається з кінцем блоку (AC-LEAVE-08, AC-LEAVE-20): кінець блоку можна обрати лише як кінець відпустки.
    if (ranges.some((r) => start === r.end)) {
      return { ok: false, code: "START_AT_BLOCK_END", message: startAtBlockEnd(formatTime(start)) };
    }
    return outside;
  }
  if (end <= start) {
    return { ok: false, code: "END_NOT_AFTER_START", message: END_MUST_BE_LATER };
  }
  if (!ranges.some((r) => end > r.start && end <= r.end)) {
    return outside;
  }

  const minutes = ranges.reduce((sum, r) => sum + Math.max(0, Math.min(end, r.end) - Math.max(start, r.start)), 0);
  return { ok: true, minutes };
}

// Підпис посади, як у прикладах PM: "Elementary school / Teacher".
export function positionLabel(position: Pick<Position, "division" | "jobTitle">): string {
  return `${position.division} / ${position.jobTitle}`;
}
