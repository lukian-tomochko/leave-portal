// UAT на проді (WS10, D): помічник календаря (requirements/05-calendar-assistant.md). «Тоді» — дослівно з AC PM.
// AC-ASSIST-01 і AC-ASSIST-02 кличуть справжню модель (безкоштовний ліміт OpenRouter — спільний на добу: ~3 запити на
// сценарій із ланцюжком); AC-ASSIST-10 і AC-ASSIST-11 моделі не потребують. Закриття, збережені сценарієм, прибираються в
// afterEach через інтерфейс адміністратора (як у calendar.spec.ts). Текст календаря — вигаданий, без справжніх даних.
import { expect, test, type Page } from "@playwright/test";
import { removeUatClosures, sessionCookies, actAs } from "./support/calendar";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

const CALENDAR_TEXT = "Winter break 28.12–08.01; Teachers' meeting 20.11 from 12:00";
const EMPTY_2026 = "No closed days in school year 2026–2027";
const ac = (id: string) => ({ type: "ac", description: id });

test.describe.configure({ timeout: 180_000 });

test.afterEach(async ({ page, browser }, testInfo) => {
  await Promise.race([attachRuntimeErrors(page).catch(() => {}), new Promise((resolve) => setTimeout(resolve, 10_000))]);
  if (testInfo.tags.includes("@writes")) await removeUatClosures(browser);
});

async function askAssistant(page: Page, text: string) {
  await page.goto("/calendar/assistant");
  // Форма — клієнтський компонент: введене до гідратації скидається, тому повторюємо введення, поки текст не лишиться.
  const field = page.getByLabel("School calendar text");
  await expect(async () => {
    await field.fill(text);
    await expect(field).toHaveValue(text, { timeout: 750 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Suggest closures" }).click();
}

const suggestions = (page: Page) => page.getByTestId("assistant-rows").getByRole("listitem");

test.describe("адміністратор", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test(
    "AC-ASSIST-01: два закриття з тексту пропонуються на перегляд, а шкільний календар лишається без закриттів",
    { tag: ["@uat"], annotation: ac("AC-ASSIST-01") },
    async ({ page }) => {
      await given("шкільний календар не має закриттів", async () => {
        await page.goto("/calendar?year=2026");
        await expect(page.getByText(EMPTY_2026)).toBeVisible();
      });
      await when(`адміністратор просить у помічника пропозиції для тексту «${CALENDAR_TEXT}»`, async () => {
        await askAssistant(page, CALENDAR_TEXT);
        await expect(page.getByTestId("assistant-suggestions")).toBeVisible({ timeout: 120_000 });
      });
      await thenStep(
        page,
        {
          clause:
            'the administrator sees 2 suggested closures — "Winter break" whole days 2026-12-28 – 2027-01-08 and "Teachers\' meeting" early dismissal on 2026-11-20 from 12:00 — and the school calendar still has no closures',
          visible: [
            "розділ «Suggested closures» із двома пропозиціями",
            "рядок «Teachers' meeting: early dismissal on 2026-11-20 from 12:00»",
            "рядок «Winter break: whole days 2026-12-28 – 2027-01-08»",
            "підказка «Nothing is saved yet»",
          ],
        },
        async () => {
          await expect(suggestions(page)).toHaveCount(2);
          const summaries = page.getByTestId("suggestion-summary");
          await expect(summaries.nth(0)).toHaveText("Teachers' meeting: early dismissal on 2026-11-20 from 12:00");
          await expect(summaries.nth(1)).toHaveText("Winter break: whole days 2026-12-28 – 2027-01-08");
          await expect(page.getByText("Nothing is saved yet")).toBeVisible();
        },
      );
      await thenStep(
        page,
        { clause: "the school calendar still has no closures", visible: ["шкільний календар 2026–2027", `повідомлення «${EMPTY_2026}»`] },
        async () => {
          await page.goto("/calendar?year=2026");
          await expect(page.getByText(EMPTY_2026)).toBeVisible();
        },
      );
    },
  );

  test(
    "AC-ASSIST-02: збереження двох пропозицій без змін — календар показує обидва закриття",
    { tag: ["@uat", "@writes"], annotation: ac("AC-ASSIST-02") },
    async ({ page }) => {
      await given("2 запропоновані закриття з AC-ASSIST-01", async () => {
        await askAssistant(page, CALENDAR_TEXT);
        await expect(suggestions(page)).toHaveCount(2, { timeout: 120_000 });
      });
      await when("адміністратор зберігає їх без змін", async () => {
        await page.getByRole("button", { name: "Save closures" }).click();
        await expect(page.getByTestId("assistant-saved").getByRole("listitem")).toHaveCount(2);
      });
      await thenStep(
        page,
        {
          clause: 'the school calendar shows "Teachers\' meeting" on 2026-11-20 from 12:00 and "Winter break" 2026-12-28 – 2027-01-08',
          visible: ["шкільний календар 2026–2027", "рядок «Teachers' meeting» із датою 2026-11-20 від 12:00", "рядок «Winter break» з датами 2026-12-28 – 2027-01-08"],
        },
        async () => {
          await page.goto("/calendar?year=2026");
          const list = page.getByTestId("calendar-closures");
          await expect(list.getByRole("listitem").filter({ hasText: "Teachers' meeting" })).toContainText("2026-11-20");
          await expect(list.getByRole("listitem").filter({ hasText: "Winter break" })).toContainText("2026-12-28 – 2027-01-08");
        },
      );
    },
  );

  test(
    "AC-ASSIST-10: текст із 2001 символу — помічника не питаємо, адміністратор бачить повідомлення про 2000 символів",
    { tag: ["@uat"], annotation: ac("AC-ASSIST-10") },
    async ({ page }) => {
      await given("адміністратор вставляє текст із 2001 символу", async () => {
        await page.goto("/calendar/assistant");
      });
      await when("адміністратор просить пропозиції", async () => {
        await askAssistant(page, "Winter break 28.12–08.01. ".padEnd(2001, "x"));
      });
      await thenStep(
        page,
        {
          clause: 'the calendar assistant is not asked, and the administrator sees the message "The text can be at most 2000 characters"',
          visible: ["форма помічника", "повідомлення «The text can be at most 2000 characters»", "жодної пропозиції немає"],
          hidden: ["модель не викликалась: відповідь прийшла одразу, без «Preparing suggestions…»"],
        },
        async () => {
          await expect(page.getByTestId("assistant-message")).toHaveText("The text can be at most 2000 characters");
          await expect(page.getByTestId("assistant-suggestions")).toHaveCount(0);
        },
      );
    },
  );
});

test.describe("працівник", () => {
  test(
    "AC-ASSIST-11: працівник за прямим посиланням бачить, що календар змінює лише адміністратор, і жодних пропозицій немає",
    { tag: ["@uat"], annotation: ac("AC-ASSIST-11") },
    async ({ page, browser }) => {
      const teacher1 = await sessionCookies(browser, "teacher1@example.test", process.env.UAT_PASSWORD_TEACHER1 ?? process.env.DEMO_USER_PASSWORD ?? "");
      await given("teacher1@example.test увійшов і має лише роль employee", async () => {
        await actAs(page, teacher1);
      });
      await when("teacher1@example.test відкриває помічника календаря за прямим посиланням", async () => {
        await page.goto("/calendar/assistant");
      });
      await thenStep(
        page,
        {
          clause: 'teacher1@example.test sees the message "Only an administrator can change the school calendar", and no closures are suggested or saved',
          visible: ["сторінка «Calendar assistant»", "повідомлення «Only an administrator can change the school calendar»", "форми помічника немає"],
        },
        async () => {
          await expect(page.getByText("Only an administrator can change the school calendar")).toBeVisible();
          await expect(page.getByTestId("assistant-form")).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Suggest closures" })).toHaveCount(0);
        },
      );
    },
  );
});
