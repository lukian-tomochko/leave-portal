import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PRODUCT_MODELS, makeProductModel } from "@/lib/ai/models";
import { CALENDAR_PROMPT_VERSION, suggestClosures, type SuggestResult } from "@/lib/calendar-assistant/suggest";
import { ASSISTANT_NEEDS_MORE_DETAILS } from "@/lib/leave/messages";
import casesJson from "../tests/fixtures/golden/cases.json";
import { meetsThreshold, passRate, scoreResult, type GoldenCase } from "../tests/support/golden-score";

// `npm run eval` — ЖИВИЙ прогін golden cases PM на безкоштовних моделях OpenRouter. Ніколи не в `npm test` і не в CI.
// Потрібен ваш ключ у .env.local (OPENROUTER_API_KEY). Без ключа всі кейси пропускаються — це не помилка.
// Перший 429 зупиняє прогін: цей і решта кейсів — NOT RUN з причиною у звіті, у частку успіху не входять.
// Таймаут, помилка постачальника, відповідь не за схемою чи правилами — FAIL з причиною (входять у частку успіху).
//   RUNS=2    — кілька прогонів поспіль для частки успіху (pass rate).
//   CASES=GC-02,GC-09 — лише названі кейси (повтор після ліміту).
//   RECORD=1  — успішні відповіді дописати в tests/fixtures/golden/recorded.json (для офлайн-реплею в CI).
// PowerShell: $env:RECORD="1"; npm run eval   (а потім Remove-Item Env:RECORD)

// CASES=GC-02,GC-09 — прогнати лише названі кейси (повтор після ліміту); без змінної — усі 10.
const only = process.env.CASES?.split(",").map((id) => id.trim());
const cases = (casesJson as GoldenCase[]).filter((c) => !only || only.includes(c.id));
const key = process.env.OPENROUTER_API_KEY?.trim();
const RECORD = process.env.RECORD === "1";
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1) || 1);
const TODAY = "2026-11-13"; // «сьогодні» в усіх golden cases PM
const RECORDED_PATH = "tests/fixtures/golden/recorded.json";
const REPORT_DIR = "evals/reports";

// Бюджет: на прогін — 10 викликів моделі з одного денного лічильника акаунта (50/день), без судді: слова PM оцінює код.
const NEEDED = RUNS * cases.length;
const GAP_MS = Number(process.env.GAP_MS ?? 3_000); // ≤ 20 запитів/хв навіть коли модель відповідає швидко (GAP_MS=8000 для ліміту постачальника)

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
// notRun — кейс не запускали через ліміт (429): у частку успіху не входить, у звіті — окремим рядком з причиною.
type Row = { run: number; id: string; modelId: string; pass: boolean; notRun?: boolean; why?: string };
const rows: Row[] = [];
const fresh: Record<string, Recording> = {};
let stoppedAt: string | undefined;

// Відповідь моделі в тому ж вигляді, що й схема: так recorded.json можна відтворити офлайн через suggestClosures.
function answerText(result: SuggestResult): string {
  if (result.status === "ok") return JSON.stringify({ status: "ok", closures: result.closures, missing: null });
  if (result.status === "needs_info") {
    return JSON.stringify({ status: "needs_info", closures: [], missing: result.message.slice(ASSISTANT_NEEDS_MORE_DETAILS.length).trim() });
  }
  return JSON.stringify({ status: "refused", closures: [], missing: null });
}

describe.skipIf(!key)("golden cases PM, живий прогін (безкоштовні моделі OpenRouter)", () => {
  beforeAll(async () => {
    // Скільки безкоштовних запитів лишилось сьогодні (UTC-доба; у листопаді скидається о 02:00 за Києвом).
    const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
    const body = (await res.json()) as { data?: { free_model_daily_requests?: { remaining?: number } } };
    const remaining = body.data?.free_model_daily_requests?.remaining;
    if (typeof remaining === "number" && remaining < NEEDED) {
      throw new Error(`Сьогодні лишилось ${remaining} безкоштовних запитів, потрібно ${NEEDED}. Запустіть завтра або зменште RUNS.`);
    }
  });

  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      it(`прогін ${run}: golden ${c.id}`, async (ctx) => {
        if (stoppedAt) {
          rows.push({ run, id: c.id, modelId: "—", pass: false, notRun: true, why: `NOT RUN: зупинено після 429 (${stoppedAt})` });
          return ctx.skip();
        }
        await sleep(GAP_MS);
        const result = await suggestClosures(c.input, TODAY, makeProductModel(key), { timeoutMs: 90_000 });
        if (result.status === "unavailable" && result.detail === "rate_limited") {
          stoppedAt = `${c.id}, прогін ${run}`;
          rows.push({ run, id: c.id, modelId: "—", pass: false, notRun: true, why: "NOT RUN: 429, ліміт безкоштовної моделі" });
          return ctx.skip();
        }
        const modelId = "modelId" in result ? result.modelId : "—";
        const score = scoreResult(c, result);
        rows.push({
          run,
          id: c.id,
          modelId,
          pass: score.pass,
          why: score.pass ? undefined : result.status === "unavailable" ? `unavailable: ${result.detail}` : score.mismatches.join("; "),
        });
        // Записуємо ЛИШЕ успішні відповіді: офлайн-реплей у CI має лишатися зеленим.
        if (RECORD && score.pass) {
          fresh[c.id] = { modelId, recordedAt: new Date().toISOString(), promptVersion: CALENDAR_PROMPT_VERSION, text: answerText(result) };
        }
        expect(score.mismatches).toEqual([]);
      });
    }
  }

  afterAll(() => {
    console.table(rows); // яка модель з ланцюжка відповіла на кожен кейс: бал — за модель, а не «за AI»
    writeReport();
    if (RECORD && Object.keys(fresh).length > 0) {
      // Злиття, а не заміна: прогін, обірваний 429, зберігає старі записи решти кейсів.
      const old = JSON.parse(readFileSync(RECORDED_PATH, "utf8")) as Record<string, Recording>;
      writeFileSync(RECORDED_PATH, JSON.stringify({ ...old, ...fresh }, null, 2) + "\n");
    }
  });
});

// Звіт для домашки: частка успіху загалом і за моделлю + кожен кейс. Файл комітять (він без секретів).
function writeReport() {
  if (rows.length === 0) return;
  const ran = rows.filter((r) => !r.notRun);
  const notRun = rows.filter((r) => r.notRun);
  const total = passRate(ran);
  const byModel = new Map<string, Row[]>();
  for (const r of ran) byModel.set(r.modelId, [...(byModel.get(r.modelId) ?? []), r]);
  const lastRun = rows.filter((r) => r.run === RUNS);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines = [
    `# Живий прогін golden cases PM — ${new Date().toISOString()}`,
    "",
    `- Промпт: \`${CALENDAR_PROMPT_VERSION}\`; ланцюжок моделей: ${PRODUCT_MODELS.map((m) => `\`${m}\``).join(" → ")}`,
    `- «Сьогодні» у кейсах: ${TODAY}; прогонів: ${RUNS}; кейсів у прогоні: ${cases.length}; слова PM оцінює код (без судді)`,
    `- **Частка успіху: ${total.passed}/${total.total} (${Math.round(total.rate * 100)}%)** — з кейсів, що отримали відповідь`,
    `- Поріг PM (≥ 8 з 10, GC-08, GC-09, GC-10 обов'язкові): ${notRun.length === 0 && meetsThreshold(lastRun) ? "виконано" : "не виконано або прогін неповний"}`,
    `- Не запущено (NOT RUN): ${notRun.length}${stoppedAt ? ` — ліміт 429, зупинено на: ${stoppedAt}` : ""}`,
    "",
    "| Модель, що відповіла | Пройшло | Усього |",
    "|---|---|---|",
    ...[...byModel].map(([m, rs]) => `| \`${m}\` | ${passRate(rs).passed} | ${rs.length} |`),
    "",
    "| Прогін | Кейс | Модель | Результат | Причина |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.run} | ${r.id} | \`${r.modelId}\` | ${r.notRun ? "NOT RUN" : r.pass ? "✅" : "❌"} | ${(r.why ?? "").replaceAll("|", "/")} |`),
    "",
  ];
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}/${stamp}.md`, lines.join("\n"));
  console.log(`Звіт: ${REPORT_DIR}/${stamp}.md`);
}
