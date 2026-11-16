import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { CALENDAR_PROMPT_VERSION } from "@/lib/ai/prompts/calendar";
import { suggestClosures } from "@/lib/calendar-assistant/suggest";
import casesJson from "./fixtures/golden/cases.json";
import recordedJson from "./fixtures/golden/recorded.json";
import { scoreResult, type GoldenCase } from "./support/golden-score";

// Офлайн-реплей golden cases PM: без мережі й без ключа, тож працює в CI (`npm test`, job `app`).
// Перевіряє КОД навколо моделі (промпт, межа <document>, схема, правила після моделі, оцінювач), а НЕ якість моделі:
// якість міряє живий прогін `npm run eval` (evals/golden.live.eval.ts), записи в recorded.json — відповіді того прогону.

type Recording = { modelId: string; recordedAt: string; promptVersion?: string; stub?: boolean; text: string };
const cases = casesJson as GoldenCase[];
const recorded = recordedJson as Record<string, Recording>;
const TODAY = "2026-11-13"; // «сьогодні» в усіх golden cases PM

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

// Модель, що «відповідає» записаним текстом.
function replay(text: string, modelId = "recorded") {
  return new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

async function runCase(c: GoldenCase) {
  const rec = recorded[c.id];
  expect(rec, `немає запису для ${c.id} у recorded.json`).toBeDefined();
  const model = replay(rec.text, rec.modelId);
  const result = await suggestClosures(c.input, TODAY, model);
  return {
    mismatches: scoreResult(c, result).mismatches,
    // Недовірений вхід дійшов до моделі загорнутим як дані.
    boundary: JSON.stringify(model.doGenerateCalls[0].prompt).includes("<document>"),
  };
}

// Назва — звичайний рядок, що ПОЧИНАЄТЬСЯ з AC ID (шаблонний рядок і .skip ac:coverage не зараховує). Кейси розкладено за AC
// з вимоги PM: пропозиції (01), бракує даних (05), відмова й ін'єкція без календаря (06), ін'єкція в чинному тексті (07).
describe("golden cases PM, офлайн-реплей", () => {
  it.each(cases.filter((c) => c.ac === "AC-ASSIST-01"))("AC-ASSIST-01: golden $id", async (c) => {
    expect(await runCase(c)).toEqual({ mismatches: [], boundary: true });
  });
  it.each(cases.filter((c) => c.ac === "AC-ASSIST-05"))("AC-ASSIST-05: golden $id", async (c) => {
    expect(await runCase(c)).toEqual({ mismatches: [], boundary: true });
  });
  it.each(cases.filter((c) => c.ac === "AC-ASSIST-06"))("AC-ASSIST-06: golden $id", async (c) => {
    expect(await runCase(c)).toEqual({ mismatches: [], boundary: true });
  });
  it.each(cases.filter((c) => c.ac === "AC-ASSIST-07"))("AC-ASSIST-07: golden $id", async (c) => {
    expect(await runCase(c)).toEqual({ mismatches: [], boundary: true });
  });

  it("AC-ASSIST-01: кожен golden case має запис, записаний поточною версією промпту", () => {
    const missing = cases.map((c) => c.id).filter((id) => !recorded[id]);
    expect(missing).toEqual([]);
    const stale = Object.entries(recorded)
      .filter(([, r]) => r.promptVersion && r.promptVersion !== CALENDAR_PROMPT_VERSION)
      .map(([id]) => id);
    // Змінили CALENDAR_PROMPT_VERSION — перезапишіть записи живим прогоном (`RECORD=1 npm run eval`).
    expect(stale).toEqual([]);
  });

  it("AC-ASSIST-06: оцінювач ловить відповідь, що порушує очікуване (кейс не проходить «за замовчуванням»)", async () => {
    const poem = cases.find((c) => c.id === "GC-08") as GoldenCase;
    const wrong = replay(JSON.stringify({ status: "ok", closures: [{ name: "Winter holidays", startsOn: "2026-12-28", endsOn: "2027-01-08", closedFrom: null }], missing: null }));

    const result = await suggestClosures(poem.input, TODAY, wrong);

    expect(scoreResult(poem, result).pass).toBe(false);
  });
});
