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

describe("llm.call у suggestClosures", () => {
  let info: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    info = vi.spyOn(console, "info").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("пише один рядок llm.call зі станом, моделлю й версією промпту, без тексту користувача й відповіді моделі", async () => {
    await suggestClosures(USER_TEXT, TODAY, answering(OK_ANSWER), { log: LOG });

    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0][0]);
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

    expect(JSON.parse(String(info.mock.calls[0][0]))).toMatchObject({ fallbackUsed: true, model: "nvidia/nemotron-3.5-super-vl:free" });
  });

  it("пише стан відмови моделі (refused) і брак даних (needs_info) як відповідь, а не як збій", async () => {
    await suggestClosures(USER_TEXT, TODAY, answering({ status: "refused", closures: [], missing: null }), { log: LOG });
    await suggestClosures(USER_TEXT, TODAY, answering({ status: "needs_info", closures: [], missing: "the dates" }), { log: LOG });

    const states = info.mock.calls.map((call) => JSON.parse(String(call[0])).state);
    expect(states).toEqual(["refused", "needs_info"]);
    expect(error).not.toHaveBeenCalled();
  });

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

    expect(info).not.toHaveBeenCalled();
    const line = String(error.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({ event: "llm.call", state: "unavailable", errorKind: "rate_limited" });
    for (const marker of MARKERS) expect(line).not.toContain(marker);
  });

  it("відповідь, що не пройшла правила, теж пишеться як unavailable з кодом rules", async () => {
    const impossibleDate = { ...OK_ANSWER, closures: [{ name: "Break", startsOn: "2027-02-31", endsOn: "2027-02-31", closedFrom: null }] };

    await suggestClosures(USER_TEXT, TODAY, answering(impossibleDate), { log: LOG });

    expect(JSON.parse(String(error.mock.calls[0][0]))).toMatchObject({ state: "unavailable", errorKind: "rules", inputTokens: 612 });
  });

  it("без налаштування log, без ключа й для задовгого тексту журналу немає", async () => {
    await suggestClosures(USER_TEXT, TODAY, answering(OK_ANSWER));
    await suggestClosures(USER_TEXT, TODAY, null, { log: LOG });
    await suggestClosures("x".repeat(2001), TODAY, answering(OK_ANSWER), { log: LOG });

    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
