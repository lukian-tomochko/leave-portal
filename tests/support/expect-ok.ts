import { expect } from "vitest";

// Перевіряє, що результат успішний, і повертає його звуженим до успішного варіанта: тест далі читає поля без `if`.
// Умовний `expect` у тесті небезпечний: якщо результат раптом неуспішний, перевірка мовчки не виконається.
export function expectOk<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}
