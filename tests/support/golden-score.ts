import type { Suggestion } from "@/lib/ai/schema";
import type { SuggestResult } from "@/lib/calendar-assistant/suggest";
import { ASSISTANT_NEEDS_MORE_DETAILS } from "@/lib/leave/messages";

// Один golden case PM (вимога 05, розділ «Golden cases»): вхід → очікуване. Формат — tests/fixtures/golden/cases.json.
// expected: точні поля, які PM фіксує однозначно (стан, закриття, дослівне повідомлення відмови).
// rubric: слова PM для вільного тексту needs_info — «must mention» (кожен елемент — варіанти через «|») і «must not».
export type GoldenCase = {
  id: string; // "GC-01"
  ac: string; // AC, під яким кейс іде в назві тесту
  input: string;
  expected: { status: "ok" | "needs_info" | "refused"; closures: Suggestion[]; message?: string };
  rubric?: { mention?: string[]; notMention?: string[] };
};

// Назви порівнюємо без регістру й з однаковим апострофом: модель може написати Teachers’ meeting.
const norm = (text: string) => text.toLowerCase().replace(/[‘’`]/g, "'").replace(/\s+/g, " ").trim();
const sameClosure = (a: Suggestion, b: Suggestion) =>
  norm(a.name) === norm(b.name) && a.startsOn === b.startsOn && a.endsOn === b.endsOn && a.closedFrom === b.closedFrom;

// Перевірка кодом, без судді: точні поля + слова PM. Повертає список розбіжностей (порожній = кейс пройдено).
export function scoreResult(c: GoldenCase, result: SuggestResult): { pass: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  if (result.status !== c.expected.status) {
    mismatches.push(`status: expected ${c.expected.status}, got ${result.status}`);
    return { pass: false, mismatches };
  }
  const got = result.status === "ok" ? result.closures : [];
  if (got.length !== c.expected.closures.length) {
    mismatches.push(`closures: expected ${c.expected.closures.length}, got ${got.length}`);
  }
  c.expected.closures.forEach((want, index) => {
    const have = got[index];
    if (!have || !sameClosure(want, have)) {
      mismatches.push(`closure ${index + 1}: expected ${JSON.stringify(want)}, got ${JSON.stringify(have ?? null)}`);
    }
  });
  const message = "message" in result ? result.message : "";
  if (c.expected.message !== undefined && message !== c.expected.message) {
    mismatches.push(`message: expected "${c.expected.message}", got "${message}"`);
  }
  if (c.expected.status === "needs_info" && !message.startsWith(ASSISTANT_NEEDS_MORE_DETAILS)) {
    mismatches.push(`message must start with "${ASSISTANT_NEEDS_MORE_DETAILS}"`);
  }
  const text = norm(message);
  for (const group of c.rubric?.mention ?? []) {
    if (!group.split("|").some((variant) => text.includes(norm(variant)))) {
      mismatches.push(`message must mention: ${group}`);
    }
  }
  for (const word of c.rubric?.notMention ?? []) {
    if (text.includes(norm(word))) {
      mismatches.push(`message must not mention: ${word}`);
    }
  }
  return { pass: mismatches.length === 0, mismatches };
}

// Частка успіху (pass rate) — визначення з WS8: прогін на задачах із відомими відповідями → бал.
export function passRate(results: { pass: boolean }[]): { passed: number; total: number; rate: number } {
  const passed = results.filter((r) => r.pass).length;
  return { passed, total: results.length, rate: results.length ? passed / results.length : 0 };
}

// Поріг PM: щонайменше 8 з 10, а GC-08, GC-09 і GC-10 завжди мають пройти.
export const REQUIRED_CASES = ["GC-08", "GC-09", "GC-10"];
export function meetsThreshold(rows: { id: string; pass: boolean }[]): boolean {
  const passed = rows.filter((r) => r.pass).length;
  return passed >= 8 && REQUIRED_CASES.every((id) => rows.find((r) => r.id === id)?.pass === true);
}
