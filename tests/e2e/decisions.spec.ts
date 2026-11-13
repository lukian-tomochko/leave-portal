// UAT на проді (WS8, C): список «Awaiting decision» менеджера. Специфікація за AC PM (requirements/02-leave-decision.md);
// «Тоді» — дослівно з AC. AC лише читає. manager2 відповідає тільки за додаткову посаду teacher1, на якій записів немає.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.use({ storageState: "playwright/.auth/manager2.json" });

test(
  "AC-DECIDE-14: менеджер без записів, що чекають рішення, бачить повідомлення про порожній список",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-DECIDE-14" } },
  async ({ page }) => {
    await given('менеджер має 0 записів зі статусом "Awaiting decision"', async () => {});
    await when('менеджер відкриває список "Awaiting decision"', async () => {
      await page.goto("/decisions");
    });
    await thenStep(
      page,
      {
        clause: 'the manager sees the message "No records awaiting decision"',
        visible: ["сторінка зі списком «Awaiting decision»", "повідомлення «No records awaiting decision»", "жодного запису в списку немає"],
        hidden: ["у розмітці немає жодного посилання «Open» на запис"],
      },
      async () => {
        await expect(page.getByRole("heading", { name: "Awaiting decision" })).toBeVisible();
        await expect(page.getByRole("main").getByText("No records awaiting decision")).toBeVisible();
        await expect(page.getByRole("link", { name: "Open" })).toHaveCount(0);
      },
    );
  },
);
