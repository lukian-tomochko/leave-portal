import { Output, generateText, type LanguageModel } from "ai";
import { classifyError, type AiFailure } from "@/lib/ai/errors";
import { isFallback, logLlmCall, type LlmState } from "@/lib/ai/llm-log";
import { PRODUCT_MODELS } from "@/lib/ai/models";
import { CALENDAR_PROMPT_VERSION, calendarInstructions, sanitizeText, wrapDocument } from "@/lib/ai/prompts/calendar";
import { AssistantAnswerSchema, type Suggestion } from "@/lib/ai/schema";
import { schoolYearOf } from "@/lib/leave/balance";
import {
  ASSISTANT_NEEDS_MORE_DETAILS,
  ASSISTANT_ONLY_CLOSURES,
  ASSISTANT_TEXT_LIMIT,
  ASSISTANT_TEXT_TOO_LONG,
  ASSISTANT_UNAVAILABLE,
} from "@/lib/leave/messages";
import { checkAnswer } from "./rules";

// Чиста функція: модель передають параметром (design.md D9). Застосунок передає модель OpenRouter
// (src/lib/ai/openrouter.ts), тести й офлайн-реплей — MockLanguageModelV4 із записаною відповіддю. Тут немає
// `import "server-only"` і немає process.env, тому Vitest може імпортувати цей файл.

export { CALENDAR_PROMPT_VERSION };

export type SuggestResult =
  | { status: "ok"; closures: Suggestion[]; modelId: string }
  | { status: "needs_info"; message: string; modelId: string }
  | { status: "refused"; message: string; modelId: string }
  | { status: "text_too_long"; message: string }
  // unavailable: немає ключа, 429, таймаут, відповідь не за схемою чи правилами (AC-ASSIST-09). detail — для логів і тестів.
  | { status: "unavailable"; message: string; detail: AiFailure | "no_key" | "rules" };

// log — куди писати llm.call (WS11, трек B): немає — журналу немає (так працюють офлайн-тести). У журнал потрапляють лише
// модель, затримка, токени, стан, fallback, версія промпту й код причини: тексту адміністратора, промпту й відповіді моделі немає.
export type SuggestOptions = { timeoutMs?: number; log?: { requestId: string; route: string } };

// Один рядок llm.call на виклик моделі (src/lib/ai/llm-log.ts). Без `log` нічого не пише.
function logCall(
  opts: SuggestOptions,
  started: number,
  call: { model: string; state: LlmState; inputTokens?: number; outputTokens?: number; errorKind?: string },
): void {
  if (!opts.log) return;
  logLlmCall({
    requestId: opts.log.requestId,
    route: opts.log.route,
    model: call.model,
    fallbackUsed: isFallback(call.model, PRODUCT_MODELS[0]),
    state: call.state,
    latencyMs: performance.now() - started,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    promptVersion: CALENDAR_PROMPT_VERSION,
    errorKind: call.errorKind,
  });
}

const unavailable = (detail: Extract<SuggestResult, { status: "unavailable" }>["detail"]): SuggestResult => ({
  status: "unavailable",
  message: ASSISTANT_UNAVAILABLE,
  detail,
});

// Довжину міряємо в кодових точках (емодзі й рідкісні літери не рахуються двічі).
export const textLength = (text: string): number => [...text].length;

export async function suggestClosures(
  rawText: string,
  today: string,
  model: LanguageModel | null,
  opts: SuggestOptions = {},
): Promise<SuggestResult> {
  // Довжина перевіряється до моделі (AC-ASSIST-10): ліміт безкоштовної моделі не витрачається.
  if (textLength(rawText) > ASSISTANT_TEXT_LIMIT) {
    return { status: "text_too_long", message: ASSISTANT_TEXT_TOO_LONG };
  }
  const text = sanitizeText(rawText);
  if (text === "") {
    return { status: "refused", message: ASSISTANT_ONLY_CLOSURES, modelId: "none" };
  }
  if (model === null) {
    return unavailable("no_key");
  }

  let answer;
  let modelId: string;
  let usage: { inputTokens?: number; outputTokens?: number };
  const started = performance.now();
  try {
    const result = await generateText({
      model,
      instructions: calendarInstructions(today, schoolYearOf(today)), // `system` в AI SDK 7 застаріле
      messages: [{ role: "user", content: [{ type: "text", text: wrapDocument(text) }] }],
      output: Output.object({ name: "closures", schema: AssistantAnswerSchema }),
      temperature: 0,
      // На безкоштовному тарифі повтор витрачає той самий денний ліміт: без повторів у циклі.
      maxRetries: 0,
      timeout: opts.timeoutMs ?? 30_000, // AC-ASSIST-09: понад 30 секунд — недоступний
    });
    answer = result.output;
    modelId = result.response.modelId;
    usage = { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens };
  } catch (error) {
    const reason = classifyError(error).reason;
    logCall(opts, started, { model: PRODUCT_MODELS[0], state: "unavailable", errorKind: reason });
    return unavailable(reason);
  }

  const checked = checkAnswer(answer);
  if (!checked.ok) {
    logCall(opts, started, { model: modelId, state: "unavailable", errorKind: "rules", ...usage });
    return unavailable("rules");
  }
  logCall(opts, started, { model: modelId, state: answer.status, ...usage });
  if (answer.status === "refused") {
    return { status: "refused", message: ASSISTANT_ONLY_CLOSURES, modelId };
  }
  if (answer.status === "needs_info") {
    const missing = answer.missing?.trim() || "the dates and names of the closures";
    return { status: "needs_info", message: `${ASSISTANT_NEEDS_MORE_DETAILS} ${missing}`, modelId };
  }
  return { status: "ok", closures: checked.closures, modelId };
}
