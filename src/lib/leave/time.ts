// Час і дати без часових поясів: усе — київська цивільна дата й локальний час (припущення PM, вимоги 01–03).

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// "08:30" → 510 (хвилин від півночі). Некоректний рядок — помилка програміста, а не користувача.
export function parseTime(value: string): number {
  const match = TIME_RE.exec(value);
  if (!match) {
    throw new RangeError(`Invalid time: ${value}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

// 510 → "08:30".
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Час із бази ("08:30:00") → "08:30".
export function trimSeconds(value: string): string {
  return value.slice(0, 5);
}

// Перевіряє форму й існування дати ("2026-02-30" не існує).
export function isValidDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// День тижня цивільної дати: 1 (пн) … 7 (нд). Рахуємо в UTC, тож локальний пояс машини не впливає.
export function weekdayOf(date: string): number {
  if (!isValidDate(date)) {
    throw new RangeError(`Invalid date: ${date}`);
  }
  const [year, month, day] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

// 150 → "2 h 30 min", 420 → "7 h", 45 → "45 min" (як у прикладах PM).
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m} min`;
  }
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Сьогоднішня цивільна дата за Києвом: "2026-10-27" (навчальний рік рахуємо за київською датою).
export function todayInKyiv(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Kyiv" }).format(now);
}
