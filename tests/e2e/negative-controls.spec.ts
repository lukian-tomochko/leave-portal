// НЕГАТИВНІ КОНТРОЛІ UAT (WS8, C) — навмисно хибні очікування. Не AC-тести: назви починаються з NC-, а не з AC ID,
// тож ac:coverage їх не рахує. У звичайному прогоні їх немає (проєкт chromium має grepInvert @negative-control);
// запуск: npm run uat:nc (UAT_NEGATIVE_CONTROLS=1 → проєкт negative-controls). Лише читання: безпечно на проді.
// Що мають показати:
//   NC-1 — у тесті неправильний очікуваний текст → перевірка падає → FAIL, хоч би що сказав агент;
//   NC-2 — текст «Тоді» у вимозі уточнено, а тест і застосунок ні → перевірки зелені, агент звіряє кадр із НОВИМ текстом PM
//          і не погоджується → NEEDS-HUMAN (розбіжність іде до людини).
// Основа — наш AC-DECIDE-14 (порожній список «Awaiting decision» у manager2).
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.use({ storageState: "playwright/.auth/manager2.json" });

const CLAUSE = 'the manager sees the message "No records awaiting decision"';
const WRONG_MESSAGE = "Nothing is waiting for your decision";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "NC-1 (AC-DECIDE-14, навмисно хибне очікування в тесті: інший текст повідомлення)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-DECIDE-14" },
      { type: "case", description: "NC-1" },
    ],
  },
  async ({ page }) => {
    await given('менеджер має 0 записів зі статусом "Awaiting decision"', async () => {});
    await when('менеджер відкриває список "Awaiting decision"', async () => {
      await page.goto("/decisions");
    });
    await thenStep(
      page,
      { clause: CLAUSE, visible: ["повідомлення «No records awaiting decision»"] },
      async () => {
        await expect(page.getByTestId("awaiting-empty")).toHaveText(WRONG_MESSAGE, { timeout: 5_000 });
      },
    );
  },
);

test(
  "NC-2 (AC-DECIDE-14, текст «Тоді» у вимозі уточнено, тест і застосунок — ні)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-DECIDE-14" },
      { type: "case", description: "NC-2" },
      {
        type: "ac-text",
        description:
          'AC-DECIDE-14: Given the manager has 0 records with status "Awaiting decision". When the manager opens the "Awaiting decision" list. Then the manager sees the message "Nothing is waiting for your decision".',
      },
    ],
  },
  async ({ page }) => {
    await given('менеджер має 0 записів зі статусом "Awaiting decision"', async () => {});
    await when('менеджер відкриває список "Awaiting decision"', async () => {
      await page.goto("/decisions");
    });
    await thenStep(
      page,
      { clause: CLAUSE, visible: ["повідомлення «No records awaiting decision»"] },
      async () => {
        await expect(page.getByTestId("awaiting-empty")).toHaveText("No records awaiting decision");
      },
    );
  },
);
