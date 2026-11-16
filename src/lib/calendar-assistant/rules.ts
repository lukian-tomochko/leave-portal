import type { AssistantAnswer, Suggestion } from "@/lib/ai/schema";
import { parseClosureForm } from "@/lib/leave/calendar-admin";

// Правила, які код перевіряє ПІСЛЯ моделі (design.md D7): модель пропонує, код вирішує. Відповідь, що їх порушує, —
// не «майже пропозиція», а збій (для людини — «unavailable», AC-ASSIST-09): нічого не пропонуємо й не виправляємо мовчки.
export type CheckResult = { ok: true; closures: Suggestion[] } | { ok: false; reason: string };

export function checkAnswer(answer: AssistantAnswer): CheckResult {
  if (answer.status !== "ok") {
    // needs_info і refused — завжди без закриттів (рішення PM #27, варіант B).
    return answer.closures.length === 0 ? { ok: true, closures: [] } : { ok: false, reason: `${answer.status} with closures` };
  }
  if (answer.closures.length === 0) {
    return { ok: false, reason: "ok without closures" };
  }
  const closures: Suggestion[] = [];
  for (const suggestion of answer.closures) {
    const early = suggestion.closedFrom !== null;
    if (early && suggestion.startsOn !== suggestion.endsOn) {
      return { ok: false, reason: "early dismissal must be one date" };
    }
    // Ті самі правила, що в ручній формі закриття (вимога 04): існування дати, кінець не раніше початку, назва 1–100
    // символів, час після 00:00 з кроком 5 хвилин.
    const parsed = parseClosureForm({
      kind: early ? "early" : "whole",
      name: suggestion.name,
      startsOn: suggestion.startsOn,
      endsOn: suggestion.endsOn,
      date: suggestion.startsOn,
      time: suggestion.closedFrom ?? "",
    });
    if (!parsed.ok) {
      return { ok: false, reason: parsed.message };
    }
    closures.push({ ...suggestion, name: parsed.input.name });
  }
  closures.sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name));
  return { ok: true, closures };
}
