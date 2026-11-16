import { Output, generateText, type LanguageModel } from "ai";
import { classifyError, type AiFailure } from "@/lib/ai/errors";
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

export type SuggestOptions = { timeoutMs?: number };

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
  } catch (error) {
    return unavailable(classifyError(error).reason);
  }

  const checked = checkAnswer(answer);
  if (!checked.ok) {
    return unavailable("rules");
  }
  if (answer.status === "refused") {
    return { status: "refused", message: ASSISTANT_ONLY_CLOSURES, modelId };
  }
  if (answer.status === "needs_info") {
    const missing = answer.missing?.trim() || "the dates and names of the closures";
    return { status: "needs_info", message: `${ASSISTANT_NEEDS_MORE_DETAILS} ${missing}`, modelId };
  }
  return { status: "ok", closures: checked.closures, modelId };
}
