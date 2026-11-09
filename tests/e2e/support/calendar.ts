// Помічники UAT шкільного календаря (WS9): дії адміністратора й працівника в окремих сесіях без запису, щоб «Дано»
// не потрапляло в кадри «Тоді», і прибирання закриттів через інтерфейс (календар — спільний прод).
// Паролі синтетичних користувачів не друкуємо; вхід — окремий контекст без відео й траси.
import { expect, type Browser, type BrowserContext, type Cookie, type Page } from "@playwright/test";
import { signIn } from "./uat";

const BASE_URL = (process.env.UAT_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** Назви закриттів, які створюють специфікації: прибирання видаляє лише їх, чужі закриття не чіпає. */
export const UAT_CLOSURE_NAMES = ["Winter break", "Staff day", "Teachers' meeting"];

export type ClosureInput = { name: string; startsOn: string; endsOn: string } | { name: string; date: string; time: string };

async function newContext(browser: Browser, storageState?: string): Promise<BrowserContext> {
  return browser.newContext({ baseURL: BASE_URL, locale: "uk-UA", timezoneId: "Europe/Kyiv", storageState });
}

/** Cookie сесії користувача: вхід в окремому контексті без запису, далі їх підставляють у записану сторінку. */
export async function sessionCookies(browser: Browser, email: string, password: string): Promise<Cookie[]> {
  const context = await newContext(browser);
  try {
    const page = await context.newPage();
    await signIn(page, email, password);
    return await context.cookies();
  } finally {
    await context.close();
  }
}

/** Перемикає записану сторінку на іншого користувача (cookie замість повторного входу на відео). */
export async function actAs(page: Page, cookies: Cookie[]) {
  await page.context().clearCookies();
  await page.context().addCookies(cookies);
}

export async function fillClosureForm(page: Page, input: ClosureInput) {
  await page.goto("/calendar/manage");
  await page.getByLabel("Назва").fill(input.name);
  if ("date" in input) {
    await page.getByLabel("Скорочений день").check();
    await page.getByLabel("Дата", { exact: true }).fill(input.date);
    await page.getByLabel("Школа закрита від").fill(input.time);
  } else {
    await page.getByLabel("Цілі дні").check();
    await page.getByLabel("Початкова дата").fill(input.startsOn);
    await page.getByLabel("Кінцева дата").fill(input.endsOn);
  }
}

export async function submitClosureForm(page: Page) {
  await page.getByRole("button", { name: "Додати закриття" }).click();
}

/** «Дано»: адміністратор у власній сесії додає закриття й чекає, поки воно з'явиться в списку. */
export async function adminAddsClosure(browser: Browser, input: ClosureInput) {
  const context = await newContext(browser, "playwright/.auth/admin.json");
  try {
    const page = await context.newPage();
    await fillClosureForm(page, input);
    await submitClosureForm(page);
    await expect(page.getByTestId("manage-closures").getByText(input.name, { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
}

/** Видаляє закриття за назвою через діалог підтвердження (як адміністратор у браузері). */
export async function removeClosureByName(page: Page, name: string) {
  await page.goto("/calendar/manage");
  const row = page.getByTestId("manage-closures").getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
  await row.getByRole("button", { name: "Видалити" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Видалити" }).click();
  await expect(page.getByTestId("manage-closures").getByText(name, { exact: true })).toHaveCount(0);
}

/** Прибирання: видаляє закриття зі списку UAT_CLOSURE_NAMES (якщо вони лишилися після тесту). */
export async function removeUatClosures(browser: Browser) {
  const context = await newContext(browser, "playwright/.auth/admin.json");
  try {
    const page = await context.newPage();
    await page.goto("/calendar/manage");
    for (const name of UAT_CLOSURE_NAMES) {
      // Точна назва, а не підрядок: справжнє закриття зі схожою назвою (наприклад, «Winter break 2027») не видаляємо.
      const rows = page.getByTestId("manage-closures").getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
      while ((await rows.count()) > 0) {
        await rows.first().getByRole("button", { name: "Видалити" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Видалити" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.goto("/calendar/manage");
      }
    }
  } finally {
    await context.close();
  }
}

/** Працівник: нова заявка на одну дату (цілий день або години) із вибором типу; доходить до підсумку. */
export async function fillRequest(
  page: Page,
  options: { date: string; type: "sick" | "personal"; hours?: { from: string; to: string } },
) {
  await page.goto("/leave/new");
  await page.getByLabel("Дата 1").fill(options.date);
  for (const box of await page.getByRole("checkbox").all()) {
    await box.check();
  }
  await page.getByLabel("Тип відпустки").selectOption(options.type);
  if (options.hours) {
    await page.getByLabel("Години", { exact: true }).check();
    await page.getByLabel("З", { exact: true }).fill(options.hours.from);
    await page.getByLabel("До", { exact: true }).fill(options.hours.to);
  } else {
    await page.getByLabel("Цілий день").check();
  }
}
