import { z } from "zod";

// Схема відповіді моделі для помічника календаря (вимога 05). Три стани status:
//   ok         — є хоча б одне закриття для перегляду;
//   needs_info — бракує даних (немає дат, немає часу закриття, неіснуюча дата): closures порожній, у missing — чого бракує;
//   refused    — текст не про шкільний календар або намагається керувати моделлю: closures порожній.
// Усі поля обов'язкові, «невідоме» = null (не .optional()): строга JSON-схема вимагає, щоб усі властивості були в required.
// Правила, які можна перевірити кодом (існування дати, порядок, крок 5 хвилин, довжина назви), живуть у
// src/lib/calendar-assistant/rules.ts, а не лише в промпті.
export const SuggestionSchema = z.object({
  name: z.string().describe("short closure name copied from the text, up to 100 characters"),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD, first closed day"),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD, last closed day; equal to startsOn for one day or an early dismissal"),
  closedFrom: z.string().regex(/^\d{2}:\d{2}$/).nullable().describe("HH:MM when the school closes early on startsOn, otherwise null"),
});

export const AssistantAnswerSchema = z.object({
  status: z.enum(["ok", "needs_info", "refused"]),
  closures: z.array(SuggestionSchema).max(30),
  missing: z.string().max(300).nullable().describe("for needs_info: what is missing, one short English sentence; otherwise null"),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;
export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>;
