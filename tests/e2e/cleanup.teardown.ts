// Прибирання після прогону (teardown проєкту setup): видаляє всіх uat-*@example.test, навіть залишки обірваних
// прогонів, і падає, якщо хоч один лишився. Підсумок — у test-results/uat-cleanup.json (його читає звіт UAT).
// Без SUPABASE_SECRET_KEY (прогін лише AC, що нічого не пишуть: --grep-invert '@writes') прибирати нічого — тесту немає.
import { writeFileSync } from "node:fs";
import { expect, test as teardown } from "@playwright/test";
import { deleteSeededRecords, deleteUatUsers, deletedThisRun, hasAdminKey } from "./support/admin";

if (hasAdminKey()) {
  teardown("прибирання: синтетичні uat-*@example.test", async () => {
    // Спершу засіяні записи (коментар uat-…) для демо-користувачів, потім синтетичні користувачі.
    // Обидва прибирання й запис підсумку виконуються до будь-якої перевірки: помилка першого не лишає користувачів у проді.
    const seeded = await deleteSeededRecords().then(
      (left) => ({ left, error: undefined as unknown }),
      (error: unknown) => ({ left: -1, error }),
    );
    const result = await deleteUatUsers();
    writeFileSync(
      "test-results/uat-cleanup.json",
      // deleted — усе, що прибрав цей прогін: afterAll специфікацій і цей teardown.
      JSON.stringify({ at: new Date().toISOString(), ...result, deleted: deletedThisRun() }, null, 2),
    );
    expect(seeded.error, "прибирання засіяних записів не вдалося").toBeUndefined();
    expect(seeded.left, "лишились засіяні записи відпустки").toBe(0);
    expect(result.remaining, "лишились синтетичні користувачі").toEqual([]);
    expect(result.leftoverRequests, "лишились заявки синтетичних користувачів").toBe(0);
  });
}
