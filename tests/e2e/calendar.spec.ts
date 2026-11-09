// UAT на проді (WS9, C): шкільний календар (requirements/04-school-calendar.md) і AC-LEAVE-22 (01-leave-request.md).
// «Тоді» — дослівно з AC PM. Записують у спільний прод лише синтетичні дані й прибирають їх: закриття видаляються через
// інтерфейс адміністратора (afterEach), синтетичні працівники uat-<run>-…@example.test — teardown (cleanup.teardown.ts),
// засіяні записи teacher1 (коментар uat-…) — deleteSeededRecords. Такі тести мають тег @writes; потрібен
// SUPABASE_SECRET_KEY у .env.local (у CI й GitHub Secrets його немає).
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import {
  POSITION_T1_MAIN,
  createSyntheticEmployee,
  deleteSeededRecords,
  hasAdminKey,
  seedRecord,
  type ScheduleBlock,
} from "./support/admin";
import {
  actAs,
  adminAddsClosure,
  fillClosureForm,
  fillRequest,
  removeClosureByName,
  removeUatClosures,
  sessionCookies,
  submitClosureForm,
} from "./support/calendar";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

const WEEK: ScheduleBlock[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "08:30", endsAt: "15:30" }));
const FRIDAY_ONLY: ScheduleBlock[] = [{ weekday: 5, startsAt: "08:30", endsAt: "15:30" }];
const TUESDAY_GAP: ScheduleBlock[] = [
  { weekday: 2, startsAt: "08:30", endsAt: "12:00" },
  { weekday: 2, startsAt: "12:30", endsAt: "15:30" },
];
const WINTER_BREAK = { name: "Winter break", startsOn: "2026-12-28", endsOn: "2027-01-08" };
const TEACHERS_MEETING = { name: "Teachers' meeting", date: "2026-11-20", time: "12:00" };
const EMPTY_2026 = "No closed days in school year 2026–2027";

// Сценарії з кількома сесіями й прибиранням довші за типові 60 с (в таймаут входить і afterEach).
test.describe.configure({ timeout: 180_000 });

// Помилки сторінки до звіту, потім прибирання після тестів, що писали: закриття (через інтерфейс адміністратора) і засіяні записи.
test.afterEach(async ({ page, browser }, testInfo) => {
  // Після actAs (підміна cookie) якийсь запит може лишитись без відповіді, і r.response() у attachRuntimeErrors чекав би
  // вічно: обмежуємо збір помилок 10 с, а не тримаємо тест до таймауту.
  await Promise.race([attachRuntimeErrors(page).catch(() => {}), new Promise((resolve) => setTimeout(resolve, 10_000))]);
  if (!testInfo.tags.includes("@writes")) return;
  await removeUatClosures(browser);
  if (hasAdminKey()) await deleteSeededRecords();
});

const ac = (id: string) => ({ type: "ac", description: id });
// Без ключа тест падає (а не пропускається): «зелений» прогін без синтетичних даних був би хибним доказом.
const needsKey = () => expect(hasAdminKey(), "потрібен SUPABASE_SECRET_KEY у .env.local для синтетичних даних").toBe(true);
const closureRow = (page: import("@playwright/test").Page, name: string) =>
  page.getByTestId("calendar-closures").getByRole("listitem").filter({ hasText: name });

test.describe("адміністратор", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("AC-CAL-01: адміністратор додає «Winter break» на цілі дні, і календар показує його з датами", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-01") }, async ({ page }) => {
    await given("шкільний календар не має закриттів", async () => {
      await page.goto("/calendar?year=2026");
      await expect(page.getByText(EMPTY_2026)).toBeVisible();
    });
    await when('адміністратор додає закриття "Winter break" на цілі дні з 2026-12-28 до 2027-01-08', async () => {
      await fillClosureForm(page, WINTER_BREAK);
      await submitClosureForm(page);
      await expect(page.getByTestId("manage-closures").getByText("Winter break", { exact: true })).toBeVisible();
    });
    await thenStep(
      page,
      {
        clause: 'the school calendar shows "Winter break" with the dates 2026-12-28 – 2027-01-08',
        visible: ["шкільний календар 2026–2027", "рядок «Winter break»", "дати «2026-12-28 – 2027-01-08»"],
      },
      async () => {
        await page.goto("/calendar?year=2026");
        await expect(closureRow(page, "Winter break")).toContainText("2026-12-28 – 2027-01-08");
      },
    );
  });

  test("AC-CAL-07: погоджений запис teacher1 блокує закриття, і адміністратор бачить перелік записів", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-07") }, async ({ page }) => {
    needsKey();
    await given('teacher1@example.test має запис 2026-12-29 08:30–15:30 зі статусом "Approved"', async () => {
      await seedRecord({ employeeEmail: "teacher1@example.test", positionId: POSITION_T1_MAIN, date: "2026-12-29", startsAt: "08:30", endsAt: "15:30", status: "approved" });
    });
    await when('адміністратор намагається додати "Winter break" з 2026-12-28 до 2027-01-08', async () => {
      await fillClosureForm(page, WINTER_BREAK);
      await submitClosureForm(page);
    });
    await thenStep(
      page,
      {
        clause:
          'the administrator sees the message "These days have leave records and cannot be closed: 2026-12-29 teacher1@example.test"',
        visible: ["форма керування календарем", "червоне повідомлення з датою 2026-12-29 і teacher1@example.test"],
      },
      async () => {
        await expect(page.getByRole("alert").filter({ hasText: "These days have leave records and cannot be closed: 2026-12-29 teacher1@example.test" })).toBeVisible();
      },
    );
    await thenStep(
      page,
      {
        clause: 'the closure is not saved, the school calendar has no "Winter break"',
        visible: ["шкільний календар 2026–2027 без закриттів", `повідомлення «${EMPTY_2026}»`],
      },
      async () => {
        await page.goto("/calendar?year=2026");
        await expect(page.getByText(EMPTY_2026)).toBeVisible();
        await expect(page.getByText("Winter break")).toHaveCount(0);
      },
    );
  });

  test("AC-CAL-08: відхилений запис не блокує закриття, і календар показує «Winter break»", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-08") }, async ({ page }) => {
    needsKey();
    await given('єдиний запис на 2026-12-29 має статус "Rejected"', async () => {
      await seedRecord({ employeeEmail: "teacher1@example.test", positionId: POSITION_T1_MAIN, date: "2026-12-29", startsAt: "08:30", endsAt: "15:30", status: "rejected" });
    });
    await when('адміністратор додає "Winter break" з 2026-12-28 до 2027-01-08', async () => {
      await fillClosureForm(page, WINTER_BREAK);
      await submitClosureForm(page);
      await expect(page.getByTestId("manage-closures").getByText("Winter break", { exact: true })).toBeVisible();
    });
    await thenStep(
      page,
      {
        clause: 'the school calendar shows "Winter break" with the dates 2026-12-28 – 2027-01-08',
        visible: ["шкільний календар 2026–2027", "рядок «Winter break»", "дати «2026-12-28 – 2027-01-08»"],
        hidden: ["закриття збережено: повідомлення про блокуючі записи немає"],
      },
      async () => {
        await page.goto("/calendar?year=2026");
        await expect(closureRow(page, "Winter break")).toContainText("2026-12-28 – 2027-01-08");
      },
    );
  });

  test("AC-CAL-09: після видалення «Winter break» календар його не показує, а 2026-12-29 приймається з годинами 08:30–15:30", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-09") }, async ({ page, browser }) => {
    needsKey();
    const employee = await createSyntheticEmployee("cal09", WEEK);
    const employeeSession = await sessionCookies(browser, employee.email, employee.password);
    const adminSession = await page.context().cookies();
    await given('"Winter break" 2026-12-28 – 2027-01-08 і працівник із розкладом Mon–Fri 08:30–15:30', async () => {
      await adminAddsClosure(browser, WINTER_BREAK);
    });
    await when('адміністратор видаляє "Winter break", а працівник потім обирає вівторок 2026-12-29 у новій заявці', async () => {
      await removeClosureByName(page, "Winter break");
      await actAs(page, employeeSession);
      await fillRequest(page, { date: "2026-12-29", type: "personal" });
      await page.getByRole("button", { name: "Показати підсумок" }).click();
    });
    await thenStep(
      page,
      {
        clause: 'the school calendar no longer shows "Winter break"',
        visible: ["шкільний календар 2026–2027", `повідомлення «${EMPTY_2026}»`],
      },
      async () => {
        await actAs(page, adminSession);
        await page.goto("/calendar?year=2026");
        await expect(page.getByText("Winter break")).toHaveCount(0);
        await expect(page.getByText(EMPTY_2026)).toBeVisible();
      },
    );
    await thenStep(
      page,
      {
        clause: "2026-12-29 is accepted with the hours 08:30–15:30",
        visible: ["підсумок заявки", "рядок «2026-12-29, 08:30–15:30»", "без повідомлення про закриту школу"],
      },
      async () => {
        await actAs(page, employeeSession);
        await fillRequest(page, { date: "2026-12-29", type: "personal" });
        await page.getByRole("button", { name: "Показати підсумок" }).click();
        await expect(page.getByTestId("summary-lines")).toContainText("2026-12-29, 08:30–15:30");
        await expect(page.getByText("The school is closed on this day")).toHaveCount(0);
        // Кадр знімає лише видиму частину: підсумок має бути в кадрі, а не під заголовком.
        await page.getByRole("button", { name: "Підтвердити" }).scrollIntoViewIfNeeded();
      },
    );
  });

  test("AC-CAL-10: кінцева дата раніше за початкову не зберігається, і адміністратор бачить повідомлення", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-10") }, async ({ page }) => {
    await given("адміністратор додає закриття", async () => {
      await page.goto("/calendar/manage");
    });
    await when("адміністратор вводить початкову дату 2027-01-08 і кінцеву дату 2026-12-28", async () => {
      await fillClosureForm(page, { name: "Winter break", startsOn: "2027-01-08", endsOn: "2026-12-28" });
      await submitClosureForm(page);
    });
    await thenStep(
      page,
      {
        clause: 'the administrator sees the message "The end date cannot be earlier than the start date"',
        visible: ["червоне повідомлення «The end date cannot be earlier than the start date»", "закриття не додано: список закриттів порожній"],
        hidden: ["назва й обидві дати лишилися у формі (перевіряє твердження)"],
      },
      async () => {
        await expect(page.getByRole("alert").filter({ hasText: "The end date cannot be earlier than the start date" })).toBeVisible();
        // Введене лишається у формі (DESIGN.md): адміністратор виправляє дату, а не вводить усе заново.
        await expect(page.getByLabel("Назва")).toHaveValue("Winter break");
        await expect(page.getByLabel("Початкова дата")).toHaveValue("2027-01-08");
        await expect(page.getByLabel("Кінцева дата")).toHaveValue("2026-12-28");
      },
    );
    await thenStep(
      page,
      { clause: "the closure is not saved", visible: ["шкільний календар 2026–2027 без закриттів", `повідомлення «${EMPTY_2026}»`] },
      async () => {
        await page.goto("/calendar?year=2026");
        await expect(page.getByText(EMPTY_2026)).toBeVisible();
      },
    );
  });

  test("AC-CAL-11: закриття «Staff day» на 2026-12-30 не зберігається, бо дата вже закрита", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-11") }, async ({ page, browser }) => {
    await given('"Winter break" 2026-12-28 – 2027-01-08', async () => {
      await adminAddsClosure(browser, WINTER_BREAK);
    });
    await when('адміністратор намагається додати закриття "Staff day" на 2026-12-30', async () => {
      await fillClosureForm(page, { name: "Staff day", startsOn: "2026-12-30", endsOn: "2026-12-30" });
      await submitClosureForm(page);
    });
    await thenStep(
      page,
      {
        clause: 'the administrator sees the message "2026-12-30 is already closed: Winter break"',
        visible: ["червоне повідомлення «2026-12-30 is already closed: Winter break»", "у списку закриттів лише «Winter break», «Staff day» немає"],
        hidden: ["закриття «Staff day» не збережено", "назва й дата лишилися у формі (перевіряє твердження)"],
      },
      async () => {
        await expect(page.getByRole("alert").filter({ hasText: "2026-12-30 is already closed: Winter break" })).toBeVisible();
        await expect(page.getByLabel("Назва")).toHaveValue("Staff day");
        await expect(page.getByLabel("Початкова дата")).toHaveValue("2026-12-30");
        await expect(page.getByTestId("manage-closures").getByText("Staff day")).toHaveCount(0);
      },
    );
  });
});

test.describe("працівник і календар", () => {
  test("AC-CAL-02: teacher1 бачить «Winter break» з датами", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-02") }, async ({ page, browser }) => {
    const teacher1 = await sessionCookies(browser, "teacher1@example.test", process.env.UAT_PASSWORD_TEACHER1 ?? process.env.DEMO_USER_PASSWORD ?? "");
    await given('адміністратор додав "Winter break" 2026-12-28 – 2027-01-08', async () => {
      await adminAddsClosure(browser, WINTER_BREAK);
    });
    await when("teacher1@example.test відкриває шкільний календар", async () => {
      await actAs(page, teacher1);
      await page.goto("/");
      await page.getByRole("link", { name: "Календар" }).click();
      await page.waitForURL((url) => url.pathname === "/calendar");
    });
    await thenStep(
      page,
      {
        clause: 'teacher1@example.test sees "Winter break" with the dates 2026-12-28 – 2027-01-08',
        visible: ["заголовок «Шкільний календар»", "навчальний рік 2026–2027", "рядок «Winter break» з датами 2026-12-28 – 2027-01-08"],
      },
      async () => {
        await expect(page.getByRole("heading", { name: "Шкільний календар" })).toBeVisible();
        await expect(closureRow(page, "Winter break")).toContainText("2026-12-28 – 2027-01-08");
      },
    );
  });

  test("AC-CAL-03: закритий день не приймається в новій заявці", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-03") }, async ({ page, browser }) => {
    needsKey();
    const employee = await createSyntheticEmployee("cal03", WEEK);
    await given('"Winter break" 2026-12-28 – 2027-01-08 і працівник із розкладом Mon–Fri 08:30–15:30', async () => {
      await adminAddsClosure(browser, WINTER_BREAK);
      await actAs(page, await sessionCookies(browser, employee.email, employee.password));
    });
    await when("працівник намагається обрати вівторок 2026-12-29 у новій заявці", async () => {
      await fillRequest(page, { date: "2026-12-29", type: "personal" });
    });
    await thenStep(
      page,
      {
        clause: 'the employee sees the message "The school is closed on this day: Winter break"',
        visible: ["форма нової заявки", "під полем дати повідомлення «The school is closed on this day: Winter break»"],
        hidden: ["дата не прийнята: підсумок заявки не створено"],
      },
      async () => {
        await expect(page.getByText("The school is closed on this day: Winter break")).toBeVisible();
      },
    );
  });

  test("AC-CAL-04: на скороченому дні заявка на цілий день створює 1 запис 08:30–12:00", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-04") }, async ({ page, browser }) => {
    needsKey();
    const employee = await createSyntheticEmployee("cal04", WEEK);
    await given('скорочений день "Teachers\' meeting" у п\'ятницю 2026-11-20 від 12:00 і працівник із розкладом Mon–Fri 08:30–15:30', async () => {
      await adminAddsClosure(browser, TEACHERS_MEETING);
      await actAs(page, await sessionCookies(browser, employee.email, employee.password));
    });
    await when('працівник просить "Personal leave" на цілий день 2026-11-20 і підтверджує підсумок', async () => {
      await fillRequest(page, { date: "2026-11-20", type: "personal" });
      await page.getByRole("button", { name: "Показати підсумок" }).click();
      await expect(page.getByTestId("summary-lines")).toContainText("2026-11-20, 08:30–12:00");
      await page.getByRole("button", { name: "Підтвердити" }).click();
      await page.waitForURL((url) => url.pathname === "/leave");
    });
    await thenStep(
      page,
      {
        clause: "1 record 2026-11-20 08:30–12:00 is created",
        visible: ["«My requests»", "один рядок: 2026-11-20, 08:30–12:00, Personal leave"],
      },
      async () => {
        const rows = page.getByTestId("my-requests").getByRole("row").filter({ hasText: "2026-11-20" });
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText("08:30–12:00");
      },
    );
  });

  test("AC-CAL-05: години після закриття не створюють заявки, працівник бачить повідомлення", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-05") }, async ({ page, browser }) => {
    needsKey();
    const employee = await createSyntheticEmployee("cal05", WEEK);
    await given("скорочений день з AC-CAL-04 і той самий працівник", async () => {
      await adminAddsClosure(browser, TEACHERS_MEETING);
      await actAs(page, await sessionCookies(browser, employee.email, employee.password));
    });
    await when("працівник вводить години 13:00–14:00 на 2026-11-20", async () => {
      await fillRequest(page, { date: "2026-11-20", type: "personal", hours: { from: "13:00", to: "14:00" } });
      await page.getByRole("button", { name: "Показати підсумок" }).click();
    });
    await thenStep(
      page,
      {
        clause: 'the employee sees the message "Hours must be within your schedule: 08:30–12:00"',
        visible: ["форма заявки з годинами 13:00–14:00", "повідомлення «Hours must be within your schedule: 08:30–12:00»"],
      },
      async () => {
        await expect(page.getByText("Hours must be within your schedule: 08:30–12:00")).toBeVisible();
      },
    );
    await thenStep(
      page,
      { clause: "no request is created", visible: ["«My requests»", "повідомлення «Заявок ще немає.»"] },
      async () => {
        await page.goto("/leave");
        await expect(page.getByText("Заявок ще немає.")).toBeVisible();
      },
    );
  });

  test("AC-CAL-12: працівник за прямим посиланням бачить, що календар змінює лише адміністратор", { tag: ["@uat"], annotation: ac("AC-CAL-12") }, async ({ page, browser }) => {
    const teacher1 = await sessionCookies(browser, "teacher1@example.test", process.env.UAT_PASSWORD_TEACHER1 ?? process.env.DEMO_USER_PASSWORD ?? "");
    await given("teacher1@example.test увійшов і має лише роль employee", async () => {
      await actAs(page, teacher1);
    });
    await when("teacher1@example.test відкриває сторінку зміни шкільного календаря за прямим посиланням", async () => {
      await page.goto("/calendar/manage");
    });
    await thenStep(
      page,
      {
        clause: 'teacher1@example.test sees the message "Only an administrator can change the school calendar"',
        visible: ["сторінка «Керування календарем»", "повідомлення «Only an administrator can change the school calendar»", "форми додавання закриття немає"],
        hidden: ["у розмітці немає форми й кнопки «Додати закриття»"],
      },
      async () => {
        await expect(page.getByText("Only an administrator can change the school calendar")).toBeVisible();
        await expect(page.getByTestId("closure-form")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Додати закриття" })).toHaveCount(0);
      },
    );
    await thenStep(
      page,
      { clause: "the school calendar is unchanged", visible: ["шкільний календар 2026–2027", `повідомлення «${EMPTY_2026}»`] },
      async () => {
        await page.goto("/calendar?year=2026");
        await expect(page.getByText(EMPTY_2026)).toBeVisible();
      },
    );
  });

  test("AC-CAL-13: менеджер не може закрити день напряму, календар не змінюється, 2026-11-27 приймається", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-13") }, async ({ page, browser }) => {
    needsKey();
    const employee = await createSyntheticEmployee("cal13", WEEK);
    const employeeSession = await sessionCookies(browser, employee.email, employee.password);
    let rpcCode: string | undefined;
    await given("manager1@example.test увійшов і не є адміністратором", async () => {
      await actAs(page, await sessionCookies(browser, "manager1@example.test", process.env.UAT_PASSWORD_MANAGER1 ?? process.env.DEMO_USER_PASSWORD ?? ""));
    });
    await when("manager1@example.test намагається закрити 2026-11-27 напряму, оминаючи сторінки порталу", async () => {
      // Прямий виклик функції бази з токеном менеджера (як зробив би будь-хто з браузерною консоллю).
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signedIn = await client.auth.signInWithPassword({
        email: "manager1@example.test",
        password: process.env.UAT_PASSWORD_MANAGER1 ?? process.env.DEMO_USER_PASSWORD ?? "",
      });
      expect(signedIn.error).toBeNull();
      const result = await client.rpc("add_school_closure", { p_name: "Staff day", p_starts_on: "2026-11-27", p_ends_on: "2026-11-27" });
      rpcCode = result.error?.code;
      await page.goto("/calendar?year=2026");
    });
    await thenStep(
      page,
      {
        clause: "the school calendar is unchanged",
        visible: ["шкільний календар 2026–2027", `повідомлення «${EMPTY_2026}»`],
        hidden: ["прямий виклик add_school_closure відхилено кодом 42501"],
      },
      async () => {
        expect(rpcCode).toBe("42501");
        await expect(page.getByText(EMPTY_2026)).toBeVisible();
      },
    );
    await thenStep(
      page,
      {
        clause: "2026-11-27 is still accepted in a new request",
        visible: ["підсумок нової заявки працівника (заявку подає працівник, а не менеджер)", "рядок «2026-11-27, 08:30–15:30» без повідомлення про закриту школу"],
      },
      async () => {
        await actAs(page, employeeSession);
        await fillRequest(page, { date: "2026-11-27", type: "personal" });
        await page.getByRole("button", { name: "Показати підсумок" }).click();
        await expect(page.getByTestId("summary-lines")).toContainText("2026-11-27, 08:30–15:30");
        await page.getByRole("button", { name: "Підтвердити" }).scrollIntoViewIfNeeded();
      },
    );
  });

  test("AC-CAL-15: у навчальному році без закриттів працівник бачить повідомлення", { tag: ["@uat"], annotation: ac("AC-CAL-15") }, async ({ page, browser }) => {
    const teacher2 = await sessionCookies(browser, "teacher2@example.test", process.env.UAT_PASSWORD_TEACHER2 ?? process.env.DEMO_USER_PASSWORD ?? "");
    await given("шкільний календар не має закриттів у навчальному році 2026–2027", async () => {
      await actAs(page, teacher2);
    });
    await when("працівник відкриває шкільний календар за навчальний рік 2026–2027", async () => {
      await page.goto("/calendar?year=2026");
    });
    await thenStep(
      page,
      {
        clause: 'the employee sees the message "No closed days in school year 2026–2027"',
        visible: ["заголовок «Шкільний календар»", "навчальний рік 2026–2027", `повідомлення «${EMPTY_2026}»`],
      },
      async () => {
        await expect(page.getByText(EMPTY_2026)).toBeVisible();
      },
    );
  });

  test("AC-LEAVE-22: кінець відпустки 12:30 на початку наступного блоку дає 1 запис 09:00–12:30 на 3 год", { tag: ["@uat", "@writes"], annotation: ac("AC-LEAVE-22") }, async ({ page, browser }) => {
    needsKey();
    const employee = await createSyntheticEmployee("leave22", TUESDAY_GAP);
    await given("посада з блоками розкладу Tue 08:30–12:00 і 12:30–15:30", async () => {
      await actAs(page, await sessionCookies(browser, employee.email, employee.password));
    });
    await when('працівник просить "Personal leave" на 2026-11-03 з 09:00 до 12:30', async () => {
      await fillRequest(page, { date: "2026-11-03", type: "personal", hours: { from: "09:00", to: "12:30" } });
      await page.getByRole("button", { name: "Показати підсумок" }).click();
    });
    await thenStep(
      page,
      {
        clause: "the gap 12:00–12:30 is not counted: a duration of 3 h",
        visible: ["підсумок заявки", "рядок «2026-11-03, 09:00–12:30» з тривалістю 3 год"],
      },
      async () => {
        await expect(page.getByTestId("summary-lines")).toContainText("2026-11-03, 09:00–12:30 (3 h");
        await page.getByRole("button", { name: "Підтвердити" }).scrollIntoViewIfNeeded();
      },
    );
    await when("працівник підтверджує підсумок", async () => {
      await page.getByRole("button", { name: "Підтвердити" }).click();
      await page.waitForURL((url) => url.pathname === "/leave");
    });
    await thenStep(
      page,
      {
        clause: "1 record 2026-11-03 09:00–12:30 is created",
        visible: ["«My requests»", "один рядок: 2026-11-03, 09:00–12:30, Personal leave"],
      },
      async () => {
        const rows = page.getByTestId("my-requests").getByRole("row").filter({ hasText: "2026-11-03" });
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText("09:00–12:30");
      },
    );
  });
});

test.describe("відвідувач без входу", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("AC-CAL-14: відвідувач за прямим посиланням бачить сторінку входу без назв і дат закриттів", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-14") }, async ({ page, browser }) => {
    await given("ніхто не увійшов (у календарі є «Winter break»)", async () => {
      await adminAddsClosure(browser, WINTER_BREAK);
    });
    await when("відвідувач відкриває шкільний календар за прямим посиланням", async () => {
      await page.goto("/calendar?year=2026");
    });
    await thenStep(
      page,
      {
        clause: "the visitor sees the sign-in page, and no closure names or dates are shown",
        visible: ["сторінка входу з полями «Email» і «Пароль»", "жодної назви чи дати закриття"],
        hidden: ["адреса — /login"],
      },
      async () => {
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByLabel("Email")).toBeVisible();
        await expect(page.getByText("Winter break")).toHaveCount(0);
        await expect(page.getByText("2026-12-28")).toHaveCount(0);
      },
    );
  });
});

test.describe("баланс на скороченому дні", () => {
  test.use({ storageState: "playwright/.auth/manager1.json" });

  test("AC-CAL-06: схвалення запису на скороченому дні дає «Sick leave» використано 1.00, а не 0.50", { tag: ["@uat", "@writes"], annotation: ac("AC-CAL-06") }, async ({ page, browser }) => {
    needsKey();
    const employee = await createSyntheticEmployee("cal06", FRIDAY_ONLY);
    let recordId = "";
    await given("скорочений день з AC-CAL-04, працівник з однією посадою (розклад Fri 08:30–15:30) і «Sick leave» використано 0.00", async () => {
      await adminAddsClosure(browser, TEACHERS_MEETING);
      ({ recordId } = await seedRecord({ employeeEmail: employee.email, positionId: employee.positionId, date: "2026-11-20", startsAt: "08:30", endsAt: "12:00", status: "awaiting_decision", leaveType: "sick" }));
    });
    await when('менеджер схвалює запис "Sick leave" на цілий день 2026-11-20 08:30–12:00', async () => {
      await page.goto(`/records/${recordId}`);
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
      await page.waitForURL((url) => url.pathname === "/decisions");
    });
    await thenStep(
      page,
      {
        clause: 'the employee\'s balances show "Sick leave" used 1.00 (210 of 210 working minutes that day), not 0.50',
        visible: ["«Баланс працівника»", "рядок «Sick leave» з використано 1.00 і залишком 17.00"],
      },
      async () => {
        await page.goto(`/balances/${employee.id}`);
        await expect(page.getByTestId("balance-sick").getByRole("cell")).toHaveText(["Sick leave", "18.00", "0.00", "1.00", "17.00"]);
      },
    );
  });
});
