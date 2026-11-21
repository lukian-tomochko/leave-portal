// Журнал llm.call (WS11, трек B) на справжньому шляху suggestClosures: один рядок JSON на виклик моделі й жодного тексту
// користувача, промпту чи відповіді моделі. Назви тестів без AC ID: це технічна перевірка, а не критерій приймання.
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CALENDAR_PROMPT_VERSION } from "@/lib/ai/prompts/calendar";
import { suggestClosures } from "./suggest";

const TODAY = "2026-11-13";
const LOG = { requestId: "3f0c2a9e-1b7d-4c55-9a3e-2f6d8e1c0b4a", route: "/calendar/assistant" };
// Вигаданий текст адміністратора з «персональними даними»: жодна його частина не має потрапити в журнал.
const USER_TEXT = "Winter break 28.12–08.01, писати на olena.test@example.test, пароль hunter2";
const MARKERS = ["Winter break", "olena.test", "@example.test", "hunter2", "писати"];

const usage = {
  inputTokens: { total: 612, noCache: 612, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 144, text: 144, reasoning: undefined },
};

const answering = (answer: object, modelId = "google/gemma-4-31b-it:free") =>
  new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({
      content: [{ type: "text" as const, text: JSON.stringify(answer) }],
      finishReason: { unified: "stop" as const, raw: undefined },
      usage,
      warnings: [],
    }),
  });

const OK_ANSWER = {
  status: "ok",
  closures: [{ name: "Winter break", startsOn: "2026-12-28", endsOn: "2027-01-08", closedFrom: null }],
  missing: null,
};

// Шпигуни за console.info і console.error: llm.call іде рівнем info, а unavailable — error.
function consoleSpies() {
  const spies = {} as { info: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn> };
  beforeEach(() => {
    spies.info = vi.spyOn(console, "info").mockImplementation(() => {});
    spies.error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());
  return spies;
}

const lineOf = (spy: ReturnType<typeof vi.spyOn>, index = 0) => String(spy.mock.calls[index][0]);

describe("llm.call у suggestClosures: відповіді моделі", () => {
  const spies = consoleSpies();

  it("пише один рядок зі станом, моделлю й версією промпту, без тексту користувача й відповіді моделі", async () => {
    await suggestClosures(USER_TEXT, TODAY, answering(OK_ANSWER), { log: LOG });

    expect(spies.info).toHaveBeenCalledTimes(1);
    const line = lineOf(spies.info);
    expect(JSON.parse(line)).toMatchObject({
      event: "llm.call",
      requestId: LOG.requestId,
      route: "/calendar/assistant",
      model: "google/gemma-4-31b-it:free",
      fallbackUsed: false,
      state: "ok",
      inputTokens: 612,
      outputTokens: 144,
      promptVersion: CALENDAR_PROMPT_VERSION,
    });
    for (const marker of MARKERS) expect(line).not.toContain(marker);
  });

  it("позначає fallback, коли відповіла не перша модель ланцюжка", async () => {
    await suggestClosures(USER_TEXT, TODAY, answering(OK_ANSWER, "nvidia/nemotron-3.5-super-vl:free"), { log: LOG });

    expect(JSON.parse(lineOf(spies.info))).toMatchObject({ fallbackUsed: true, model: "nvidia/nemotron-3.5-super-vl:free" });
  });

  it("відмову моделі (refused) і брак даних (needs_info) пише як відповідь, а не як збій", async () => {
    await suggestClosures(USER_TEXT, TODAY, answering({ status: "refused", closures: [], missing: null }), { log: LOG });
    await suggestClosures(USER_TEXT, TODAY, answering({ status: "needs_info", closures: [], missing: "the dates" }), { log: LOG });

    expect([0, 1].map((index) => JSON.parse(lineOf(spies.info, index)).state)).toEqual(["refused", "needs_info"]);
    expect(spies.error).not.toHaveBeenCalled();
  });
});

describe("llm.call у suggestClosures: збої й пропуски", () => {
  const spies = consoleSpies();

  it("збій моделі пише рядок рівня error зі станом unavailable і кодом причини, без тексту помилки", async () => {
    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: `Rate limit exceeded for ${USER_TEXT}`,
          url: "https://openrouter.test/api/v1/chat/completions",
          requestBodyValues: { text: USER_TEXT },
          statusCode: 429,
          isRetryable: false,
        });
      },
    });

    await suggestClosures(USER_TEXT, TODAY, failing, { log: LOG });

    expect(spies.info).not.toHaveBeenCalled();
    const line = lineOf(spies.error);
    expect(JSON.parse(line)).toMatchObject({ event: "llm.call", state: "unavailable", errorKind: "rate_limited" });
    for (const marker of MARKERS) expect(line).not.toContain(marker);
  });

  it("відповідь, що не пройшла правила, теж пишеться як unavailable з кодом rules", async () => {
    const impossibleDate = { ...OK_ANSWER, closures: [{ name: "Break", startsOn: "2027-02-31", endsOn: "2027-02-31", closedFrom: null }] };

    await suggestClosures(USER_TEXT, TODAY, answering(impossibleDate), { log: LOG });

    expect(JSON.parse(lineOf(spies.error))).toMatchObject({ state: "unavailable", errorKind: "rules", inputTokens: 612 });
  });

  it("без налаштування log, без ключа й для задовгого тексту журналу немає", async () => {
    await suggestClosures(USER_TEXT, TODAY, answering(OK_ANSWER));
    await suggestClosures(USER_TEXT, TODAY, null, { log: LOG });
    await suggestClosures("x".repeat(2001), TODAY, answering(OK_ANSWER), { log: LOG });

    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
  });
});
