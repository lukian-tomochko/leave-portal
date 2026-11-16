import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Ланцюжок безкоштовних моделей OpenRouter (перевірено `npm run ai:models` 16.11.2026). Безкоштовні моделі з'являються й
// зникають: перед роботою запустіть `npm run ai:models` і перевірте ланцюжок живим прогоном `npm run eval`.
// Порядок = пріоритет. Лише ID із `:free`: платна модель у списку fallback оплачується за її ціною.
//   gemma-4-31b / gemma-4-26b — немає structured_outputs: json_schema може бути проігноровано, тому поля повторено в
//     промпті, а zod — ворота;
//   nemotron-3.5-super-vl     — строга схема (structured_outputs).
export const PRODUCT_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-super-vl:free",
] as const;

// Фабрика приймає ключ параметром і НЕ читає process.env: так її можна імпортувати в eval-скрипті.
// У коді застосунку модель бере лише src/lib/ai/openrouter.ts (server-only).
export function makeProductModel(apiKey: string | undefined) {
  const openrouter = createOpenRouter({ apiKey, appName: "Leave portal calendar assistant" });
  return openrouter.chat(PRODUCT_MODELS[0], {
    // OpenRouter пробує наступну модель при помилці, ліміті постачальника або простої.
    // Платформний ліміт безкоштовних моделей (20/хв, 50/день на акаунт) ланцюжок НЕ обходить.
    models: [...PRODUCT_MODELS],
    reasoning: { effort: "low", exclude: true },
  });
}
