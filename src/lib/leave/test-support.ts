// Помічник для тестів: звужує результат планування до успішного без `if` у тілі тесту. Правило лінтера
// `vitest/no-conditional-expect` забороняє перевірки всередині умов: тест, що розгалужується, сам вирішує, чи щось
// перевіряти. Якщо результат не успішний, помічник кидає помилку, і тест падає з видимою причиною.
export function assertOk<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error(`Очікували успішний результат, отримали: ${JSON.stringify(result)}`);
  }
  return result as Extract<T, { ok: true }>;
}
