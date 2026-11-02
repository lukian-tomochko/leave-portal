// UAT на проді (WS8, C): баланси відпусток. Специфікації за AC PM (requirements/03-leave-balance.md); «Тоді» — дослівно з AC.
// Обидва AC лише читають: нічого не створюють і не змінюють. Входи ролей — playwright/.auth/*.json з auth.setup.ts.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.describe("власний баланс", () => {
  // teacher2 не має жодного запису (ні погодженого, ні на розгляді): це «працівник без погоджених записів».
  test.use({ storageState: "playwright/.auth/teacher2.json" });

  test(
    "AC-BALANCE-01: працівник без погоджених записів і перенесених днів бачить початкові баланси",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-BALANCE-01" } },
    async ({ page }) => {
      await given("працівник без погоджених записів у навчальному році 2026–2027 і без перенесених днів", async () => {});
      await when("працівник переглядає свої баланси", async () => {
        await page.goto("/balances");
      });
      await thenStep(
        page,
        {
          clause:
            '"Sick leave" — granted 18.00, used 0.00, remaining 18.00; "Personal leave" — granted 18.00, used 0.00, remaining 18.00; "Unpaid leave" and "Family celebration" — used 0.00 only',
          visible: [
            "рядок «Sick leave»: Granted 18.00, Used 0.00, Remaining 18.00",
            "рядок «Personal leave»: Granted 18.00, Used 0.00, Remaining 18.00",
            "рядок «Unpaid leave»: Used 0.00, решта клітинок без значень",
            "рядок «Family celebration»: Used 0.00, решта клітинок без значень",
          ],
          hidden: ["заголовок «Навчальний рік 2026–2027» (точний тире на кадрі не доводиться)"],
        },
        async () => {
          await expect(page.getByRole("heading", { name: "Навчальний рік 2026–2027" })).toBeVisible();
          // Колонки таблиці: Leave type, Granted, Carried over, Used, Remaining.
          await expect(page.getByTestId("balance-sick").getByRole("cell")).toHaveText(["Sick leave", "18.00", "0.00", "0.00", "18.00"]);
          await expect(page.getByTestId("balance-personal").getByRole("cell")).toHaveText([
            "Personal leave",
            "18.00",
            "0.00",
            "0.00",
            "18.00",
          ]);
          await expect(page.getByTestId("balance-unpaid").getByRole("cell")).toHaveText(["Unpaid leave", "—", "—", "0.00", "—"]);
          await expect(page.getByTestId("balance-family").getByRole("cell")).toHaveText(["Family celebration", "—", "—", "0.00", "—"]);
        },
      );
    },
  );
});

test.describe("баланс іншого працівника", () => {
  test.use({ storageState: "playwright/.auth/teacher1.json" });

  test(
    "AC-BALANCE-13: працівник не бачить балансів іншого працівника",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-BALANCE-13" } },
    async ({ page, browser }) => {
      let otherEmployeePath = "";

      await given("працівник teacher1@example.test і інший працівник з власним балансом", async () => {
        // Адресу сторінки балансу іншого працівника бере менеджер, який керує його посадою (посилання «Відкрити» у списку
        // «Баланси працівників»). Окремий контекст без запису відео: це підготовка, а не крок AC.
        const manager = await browser.newContext({
          baseURL: test.info().project.use.baseURL,
          storageState: "playwright/.auth/manager1.json",
        });
        const managerPage = await manager.newPage();
        await managerPage.goto("/balances");
        otherEmployeePath =
          (await managerPage
            .getByTestId("balance-employees")
            .getByRole("listitem")
            .filter({ hasText: "Демо-Вчитель-Друга" })
            .getByRole("link")
            .getAttribute("href")) ?? "";
        await manager.close();
        expect(otherEmployeePath).toMatch(/^\/balances\/[0-9a-f-]{36}$/);
      });
      await when("teacher1@example.test намагається переглянути баланси іншого працівника за прямим посиланням", async () => {
        await page.goto(otherEmployeePath);
      });
      await thenStep(
        page,
        {
          clause: "the balances are not shown",
          visible: ["сторінка «Баланс працівника» з повідомленням про відмову", "таблиці балансів на сторінці немає"],
          hidden: ["у розмітці немає рядків «Sick leave» і «Personal leave», таблиці балансів теж"],
        },
        async () => {
          await expect(page.getByRole("heading", { name: "Баланс працівника" })).toBeVisible();
          await expect(page.getByRole("main").getByText("Недостатньо прав або запис змінився. Оновіть сторінку.")).toBeVisible();
          await expect(page.getByTestId("balances")).toHaveCount(0);
          await expect(page.getByText("Sick leave")).toHaveCount(0);
          await expect(page.getByText("Personal leave")).toHaveCount(0);
        },
      );
    },
  );
});
