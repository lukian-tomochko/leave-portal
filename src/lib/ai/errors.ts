import { APICallError, NoObjectGeneratedError, RetryError } from "ai";

// Причина збою виклику моделі. Для інтерфейсу всі вони — «unavailable» (AC-ASSIST-09), але для логів і тестів розрізняємо.
export type AiFailure = "invalid_output" | "rate_limited" | "timeout" | "provider_error";

export function classifyError(error: unknown): { reason: AiFailure; message: string } {
  // Після повторів AI SDK загортає останню помилку в RetryError — спершу розгортаємо.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (NoObjectGeneratedError.isInstance(cause)) {
    return { reason: "invalid_output", message: "model output did not match the schema" };
  }
  if (APICallError.isInstance(cause)) {
    // OpenRouter може відповісти HTTP 200 з тілом `error`; провайдер тоді кидає statusCode 200 + data.
    const code = cause.statusCode === 200 ? (cause.data as { code?: unknown } | undefined)?.code : cause.statusCode;
    if (code === 429 || code === "429") {
      return { reason: "rate_limited", message: "free-model limit reached, try later" };
    }
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
    return { reason: "timeout", message: "model did not answer in time" };
  }
  return { reason: "provider_error", message: cause instanceof Error ? cause.message : String(cause) };
}
