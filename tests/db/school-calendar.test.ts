// Тести бази для шкільного календаря (вимога 03, закриття школи): PGlite застосовує наші міграції й сид, а запити йдуть
// від імені конкретних користувачів (роль authenticated). Додавання й видалення закриття — лише через
// public.add_school_closure / public.remove_school_closure; кожен тест відмови перевіряє і саму відмову, і те, що
// дані не змінились. Таблицю school_closures читаємо й чистимо суперкористувачем PGlite (db.query), щоб тести не
// залежали від grant для service_role; записи відпустки готуємо через asService.
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createLeaveDb, type LeaveDb } from "./supabase-pglite";

// Посади сиду (supabase/seed.sql): teacher1 — основна пн–пт 08:30–15:30; teacher2 — основна.
const POSITION_T1_MAIN = "00000000-0000-4000-8000-000000000101";
const POSITION_T2_MAIN = "00000000-0000-4000-8000-000000000103";

type Overlap = { date: string; name: string };
type Blocker = { date: string; email: string };
type ClosureResult = {
  ok: boolean;
  id?: string;
  code?: string;
  overlaps?: Overlap[];
  records?: Blocker[];
};
type ClosureRow = { name: string; starts_on: string; ends_on: string; closed_from: string | null };

let t: LeaveDb;
// Заявки, створені тестом: після кожного тесту видаляємо їх разом із записами й закриттями.
let requestIds: string[] = [];

beforeAll(async () => {
  t = await createLeaveDb();
}, 60_000);

afterEach(async () => {
  await t.db.query("delete from public.school_closures");
  await t.asService("delete from public.leave_records where request_id = any($1::uuid[])", [requestIds]);
  await t.asService("delete from public.leave_requests where id = any($1::uuid[])", [requestIds]);
  requestIds = [];
});

afterAll(async () => {
  await t.db.close();
});

const user = (name: string) => t.users[`${name}@example.test`];

async function addClosure(
  who: string,
  name: string,
  startsOn: string,
  endsOn: string,
  closedFrom: string | null = null,
): Promise<ClosureResult> {
  const rows = await t.asUser<{ r: ClosureResult }>(
    user(who),
    "select public.add_school_closure($1, $2::date, $3::date, $4::time) as r",
    [name, startsOn, endsOn, closedFrom],
  );
  return rows[0].r;
}

async function removeClosure(who: string, id: string): Promise<ClosureResult> {
  const rows = await t.asUser<{ r: ClosureResult }>(user(who), "select public.remove_school_closure($1::uuid) as r", [id]);
  return rows[0].r;
}

// Закриття напряму (обхід функцій): готує дані для тестів перетину й видалення.
async function seedClosure(name: string, startsOn: string, endsOn: string): Promise<string> {
  const result = await t.db.query<{ id: string }>(
    "insert into public.school_closures (name, starts_on, ends_on, created_by) values ($1, $2, $3, $4) returning id",
    [name, startsOn, endsOn, user("admin")],
  );
  return result.rows[0].id;
}

const closureCount = async () =>
  (await t.db.query<{ n: number }>("select count(*)::int as n from public.school_closures")).rows[0].n;

async function closureRows(): Promise<ClosureRow[]> {
  const result = await t.db.query<ClosureRow>(
    `select name, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on,
            to_char(closed_from, 'HH24:MI') as closed_from
       from public.school_closures order by starts_on`,
  );
  return result.rows;
}

// Запис відпустки напряму (обхід RLS і розкладу): статус задаємо явно.
async function makeRecord(
  employee: string,
  position: string,
  date: string,
  status: string,
  startsAt = "08:30",
  endsAt = "15:30",
): Promise<void> {
  const [request] = await t.asService<{ id: string }>(
    "insert into public.leave_requests (employee_id, leave_type, comment) values ($1, 'sick', 'Doctor''s appointment') returning id",
    [user(employee)],
  );
  requestIds.push(request.id);
  await t.asService(
    `insert into public.leave_records (request_id, employee_id, position_id, leave_date, starts_at, ends_at, status)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [request.id, user(employee), position, date, startsAt, endsAt, status],
  );
}

it("AC-CAL-01: адміністратор додає «Winter break» на цілі дні 2026-12-28 – 2027-01-08, календар показує їх", async () => {
  const result = await addClosure("admin", "Winter break", "2026-12-28", "2027-01-08");

  expect(result.ok).toBe(true);
  expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(await closureRows()).toEqual([
    { name: "Winter break", starts_on: "2026-12-28", ends_on: "2027-01-08", closed_from: null },
  ]);
});

it("AC-CAL-02: teacher1@example.test бачить «Winter break» з датами 2026-12-28 – 2027-01-08", async () => {
  await addClosure("admin", "Winter break", "2026-12-28", "2027-01-08");

  const seen = await t.asUser<ClosureRow>(
    user("teacher1"),
    `select name, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on
       from public.school_closures`,
  );

  expect(seen).toEqual([{ name: "Winter break", starts_on: "2026-12-28", ends_on: "2027-01-08" }]);
});

it("AC-CAL-07: запис Approved на 2026-12-29 блокує закриття «Winter break», дані не змінюються", async () => {
  await makeRecord("teacher1", POSITION_T1_MAIN, "2026-12-29", "approved");
  const before = await closureCount();

  const result = await addClosure("admin", "Winter break", "2026-12-28", "2027-01-08");

  expect(result).toMatchObject({ ok: false, code: "blocked", records: [{ date: "2026-12-29", email: "teacher1@example.test" }] });
  expect(result.id).toBeUndefined();
  expect(await closureCount()).toBe(before);
  expect(await closureRows()).toEqual([]);
});

it("AC-CAL-07: записи awaiting_decision і returned_for_revision теж блокують закриття, дані не змінюються", async () => {
  await makeRecord("teacher1", POSITION_T1_MAIN, "2026-12-29", "awaiting_decision");
  await makeRecord("teacher2", POSITION_T2_MAIN, "2026-12-30", "returned_for_revision");
  const before = await closureCount();

  const result = await addClosure("admin", "Winter break", "2026-12-28", "2027-01-08");

  expect(result).toMatchObject({
    ok: false,
    code: "blocked",
    records: [
      { date: "2026-12-29", email: "teacher1@example.test" },
      { date: "2026-12-30", email: "teacher2@example.test" },
    ],
  });
  expect(await closureCount()).toBe(before);
});

it("AC-CAL-07: блокуючі записи впорядковані за датою, потім за email", async () => {
  await makeRecord("teacher2", POSITION_T2_MAIN, "2026-12-29", "approved");
  await makeRecord("teacher1", POSITION_T1_MAIN, "2026-12-30", "approved");
  await makeRecord("teacher1", POSITION_T1_MAIN, "2026-12-29", "approved");
  const before = await closureCount();

  const result = await addClosure("admin", "Winter break", "2026-12-28", "2027-01-08");

  expect(result).toMatchObject({
    ok: false,
    code: "blocked",
    records: [
      { date: "2026-12-29", email: "teacher1@example.test" },
      { date: "2026-12-29", email: "teacher2@example.test" },
      { date: "2026-12-30", email: "teacher1@example.test" },
    ],
  });
  expect(await closureCount()).toBe(before);
});

it("AC-CAL-08: єдиний запис на 2026-12-29 зі статусом Rejected не блокує закриття, воно зберігається", async () => {
  await makeRecord("teacher1", POSITION_T1_MAIN, "2026-12-29", "rejected");

  const result = await addClosure("admin", "Winter break", "2026-12-28", "2027-01-08");

  expect(result.ok).toBe(true);
  expect(await closureRows()).toEqual([
    { name: "Winter break", starts_on: "2026-12-28", ends_on: "2027-01-08", closed_from: null },
  ]);
});

it("AC-CAL-08: запис зі статусом Cancelled не блокує закриття", async () => {
  await makeRecord("teacher1", POSITION_T1_MAIN, "2026-12-29", "cancelled");

  const result = await addClosure("admin", "Winter break", "2026-12-28", "2027-01-08");

  expect(result.ok).toBe(true);
  expect(await closureCount()).toBe(1);
});

it("AC-CAL-10: кінець 2026-12-28 раніше за початок 2027-01-08 — закриття не зберігається", async () => {
  const before = await closureCount();

  const result = await addClosure("admin", "Winter break", "2027-01-08", "2026-12-28");

  expect(result).toMatchObject({ ok: false, code: "end_before_start" });
  expect(result.id).toBeUndefined();
  expect(await closureCount()).toBe(before);
});

it("AC-CAL-11: 2026-12-30 уже закритий «Winter break» — «Staff day» не зберігається", async () => {
  await seedClosure("Winter break", "2026-12-28", "2027-01-08");
  const before = await closureCount();

  const result = await addClosure("admin", "Staff day", "2026-12-30", "2026-12-30");

  expect(result).toMatchObject({ ok: false, code: "overlap", overlaps: [{ date: "2026-12-30", name: "Winter break" }] });
  expect(await closureCount()).toBe(before);
  expect((await closureRows()).map((row) => row.name)).toEqual(["Winter break"]);
});

it("AC-CAL-11: два перетини — по одному запису на закриття: перша спільна дата й назва, за датою", async () => {
  await seedClosure("Winter break", "2026-12-28", "2027-01-08");
  await seedClosure("Staff day", "2027-01-12", "2027-01-12");
  const before = await closureCount();

  const result = await addClosure("admin", "Long break", "2027-01-05", "2027-01-15");

  expect(result).toMatchObject({
    ok: false,
    code: "overlap",
    overlaps: [
      { date: "2027-01-05", name: "Winter break" },
      { date: "2027-01-12", name: "Staff day" },
    ],
  });
  expect(await closureCount()).toBe(before);
});

it("AC-CAL-13: manager1 не додає закриття 2026-11-27 через функцію, календар не змінюється", async () => {
  const before = await closureCount();

  await expect(addClosure("manager1", "Day off", "2026-11-27", "2026-11-27")).rejects.toThrow(/forbidden/);
  await expect(addClosure("teacher1", "Day off", "2026-11-27", "2026-11-27")).rejects.toThrow(/forbidden/);

  expect(await closureCount()).toBe(before);
});

it("AC-CAL-13: manager1 не вставляє й не видаляє закриття напряму в таблиці, календар не змінюється", async () => {
  await seedClosure("Winter break", "2026-12-28", "2027-01-08");
  const before = await closureRows();

  await expect(
    t.asUser(
      user("manager1"),
      "insert into public.school_closures (name, starts_on, ends_on, created_by) values ('Day off', '2026-11-27', '2026-11-27', $1)",
      [user("manager1")],
    ),
  ).rejects.toThrow(/permission denied/);
  await expect(t.asUser(user("manager1"), "delete from public.school_closures")).rejects.toThrow(/permission denied/);
  await expect(t.asUser(user("manager1"), "update public.school_closures set name = 'Hacked'")).rejects.toThrow(
    /permission denied/,
  );

  expect(await closureRows()).toEqual(before);
});

it("AC-CAL-13: навіть адміністратор не вставляє закриття напряму в таблиці", async () => {
  const before = await closureCount();

  await expect(
    t.asUser(
      user("admin"),
      "insert into public.school_closures (name, starts_on, ends_on, created_by) values ('Day off', '2026-11-27', '2026-11-27', $1)",
      [user("admin")],
    ),
  ).rejects.toThrow(/permission denied/);

  expect(await closureCount()).toBe(before);
});

it("AC-CAL-13: після відмови 2026-11-27 (п'ятниця) далі приймається в новій заявці teacher1", async () => {
  await expect(addClosure("manager1", "Day off", "2026-11-27", "2026-11-27")).rejects.toThrow(/forbidden/);

  const created = await t.asUser<{ id: string }>(
    user("teacher1"),
    "select public.create_leave_request('sick', $1::jsonb, null, null) as id",
    [JSON.stringify([{ position_id: POSITION_T1_MAIN, leave_date: "2026-11-27", starts_at: "08:30", ends_at: "15:30" }])],
  );
  requestIds.push(created[0].id);

  const records = await t.asService<{ leave_date: string }>(
    "select to_char(leave_date, 'YYYY-MM-DD') as leave_date from public.leave_records where request_id = $1",
    [created[0].id],
  );
  expect(records).toEqual([{ leave_date: "2026-11-27" }]);
  expect(await closureCount()).toBe(0);
});

it("AC-CAL-09: адміністратор видаляє закриття, воно зникає з календаря", async () => {
  const id = await seedClosure("Winter break", "2026-12-28", "2027-01-08");

  const result = await removeClosure("admin", id);

  expect(result).toMatchObject({ ok: true });
  expect(await closureCount()).toBe(0);
});

it("AC-CAL-09: не адміністратор не видаляє закриття, воно лишається", async () => {
  const id = await seedClosure("Winter break", "2026-12-28", "2027-01-08");
  const before = await closureRows();

  await expect(removeClosure("manager1", id)).rejects.toThrow(/forbidden/);
  await expect(removeClosure("teacher1", id)).rejects.toThrow(/forbidden/);

  expect(await closureRows()).toEqual(before);
});

it("AC-CAL-01: дострокове закриття «Teachers' meeting» 2026-11-20 з 12:00 зберігається з часом закриття", async () => {
  const result = await addClosure("admin", "Teachers' meeting", "2026-11-20", "2026-11-20", "12:00");

  expect(result.ok).toBe(true);
  expect(await closureRows()).toEqual([
    { name: "Teachers' meeting", starts_on: "2026-11-20", ends_on: "2026-11-20", closed_from: "12:00" },
  ]);
});

it("AC-CAL-07: запис 09:00–11:00 до часу закриття 12:00 не блокує дострокове закриття", async () => {
  await makeRecord("teacher1", POSITION_T1_MAIN, "2026-11-20", "approved", "09:00", "11:00");

  const result = await addClosure("admin", "Teachers' meeting", "2026-11-20", "2026-11-20", "12:00");

  expect(result.ok).toBe(true);
  expect(await closureCount()).toBe(1);
});

it("AC-CAL-07: запис 13:00–14:00 після часу закриття 12:00 блокує дострокове закриття, дані не змінюються", async () => {
  await makeRecord("teacher1", POSITION_T1_MAIN, "2026-11-20", "approved", "13:00", "14:00");
  const before = await closureCount();

  const result = await addClosure("admin", "Teachers' meeting", "2026-11-20", "2026-11-20", "12:00");

  expect(result).toMatchObject({ ok: false, code: "blocked", records: [{ date: "2026-11-20", email: "teacher1@example.test" }] });
  expect(await closureCount()).toBe(before);
});

it("AC-CAL-01: назва: порожня й пуста назва — name_empty, закриття не зберігається", async () => {
  const before = await closureCount();

  const empty = await addClosure("admin", "", "2026-12-28", "2027-01-08");
  const blank = await addClosure("admin", "   ", "2026-12-28", "2027-01-08");

  expect(empty).toMatchObject({ ok: false, code: "name_empty" });
  expect(blank).toMatchObject({ ok: false, code: "name_empty" });
  expect(await closureCount()).toBe(before);
});

it("AC-CAL-01: назва: назва зі 101 символу — name_too_long, закриття не зберігається", async () => {
  const before = await closureCount();

  const result = await addClosure("admin", "x".repeat(101), "2026-12-28", "2027-01-08");

  expect(result).toMatchObject({ ok: false, code: "name_too_long" });
  expect(await closureCount()).toBe(before);
});

it("AC-CAL-01: назва: назва зі 100 символів зберігається", async () => {
  const name = "x".repeat(100);

  const result = await addClosure("admin", name, "2026-12-28", "2027-01-08");

  expect(result.ok).toBe(true);
  expect((await closureRows()).map((row) => row.name)).toEqual([name]);
});
