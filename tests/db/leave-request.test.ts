// Тести бази для подання заявки (вимога 01): PGlite застосовує наші міграції й сид, запити йдуть від імені
// конкретних користувачів (роль authenticated). Подання — лише через public.create_leave_request (міграція
// 20261027130000_leave_request_hardening.sql); кожен тест відмови перевіряє і саму відмову, і те, що дані не змінились.
import { afterAll, beforeAll, expect, it } from "vitest";
import { createLeaveDb, type LeaveDb } from "./supabase-pglite";

// Посади сиду (supabase/seed.sql): teacher1 — основна пн–пт 08:30–15:30 й додаткова пн 15:45–17:00; teacher2 — основна.
const POSITION_T1_MAIN = "00000000-0000-4000-8000-000000000101";
const POSITION_T1_ADDITIONAL = "00000000-0000-4000-8000-000000000102";
const POSITION_T2_MAIN = "00000000-0000-4000-8000-000000000103";

type RecordInput = { position_id: string; leave_date: string; starts_at: string; ends_at: string };

let t: LeaveDb;

beforeAll(async () => {
  t = await createLeaveDb();
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

const user = (email: string) => t.users[`${email}@example.test`];
const rec = (position_id: string, leave_date: string, starts_at: string, ends_at: string): RecordInput => ({
  position_id,
  leave_date,
  starts_at,
  ends_at,
});

async function submit(email: string, records: RecordInput[], comment: string | null = null): Promise<string> {
  const rows = await t.asUser<{ id: string }>(
    user(email),
    "select public.create_leave_request('sick', $1::jsonb, null, $2) as id",
    [JSON.stringify(records), comment],
  );
  return rows[0].id;
}

// Кількість заявок і записів у базі (в обхід RLS): після відмови вона не змінюється.
const counts = async () =>
  (
    await t.asService<{ requests: number; records: number }>(
      `select (select count(*) from public.leave_requests)::int as requests,
              (select count(*) from public.leave_records)::int as records`,
    )
  )[0];

it("AC-LEAVE-06: день без розкладу посади не приймається ні прямим insert, ні функцією, нічого не створено", async () => {
  const before = await counts();

  await expect(
    t.asUser(
      user("teacher1"),
      "insert into public.leave_requests (employee_id, leave_type) values ($1, 'sick')",
      [user("teacher1")],
    ),
  ).rejects.toThrow(/permission denied/);
  // 2027-01-16 — субота, розкладу посади в цей день немає.
  await expect(submit("teacher1", [rec(POSITION_T1_MAIN, "2027-01-16", "08:30", "15:30")])).rejects.toThrow(
    /hours_outside_schedule/,
  );

  expect(await counts()).toEqual(before);
});

it("AC-LEAVE-07: години поза блоком розкладу функція відхиляє, нічого не створено", async () => {
  const before = await counts();

  // Початок 08:00 раніше за блок 08:30–15:30.
  await expect(submit("teacher1", [rec(POSITION_T1_MAIN, "2027-01-11", "08:00", "11:00")])).rejects.toThrow(
    /hours_outside_schedule/,
  );
  // Години 06:00–23:00 повністю поза розкладом.
  await expect(submit("teacher1", [rec(POSITION_T1_MAIN, "2027-01-11", "06:00", "23:00")])).rejects.toThrow(
    /hours_outside_schedule/,
  );

  expect(await counts()).toEqual(before);
});

it("AC-LEAVE-10: заявка без записів не створюється ні функцією, ні прямим insert записів", async () => {
  const before = await counts();

  await expect(submit("teacher1", [])).rejects.toThrow(/non-empty array/);
  await expect(
    t.asUser(
      user("teacher1"),
      `insert into public.leave_records (request_id, employee_id, position_id, leave_date, starts_at, ends_at)
       values (gen_random_uuid(), $1, $2, '2027-01-12', '09:00', '10:00')`,
      [user("teacher1"), POSITION_T1_MAIN],
    ),
  ).rejects.toThrow(/permission denied/);

  expect(await counts()).toEqual(before);
});

it("AC-LEAVE-13: перетин із записом на розгляді відхиляє заявку, кількість заявок і записів не змінюється", async () => {
  await submit("teacher1", [rec(POSITION_T1_MAIN, "2027-02-01", "09:00", "11:00")]);
  const before = await counts();

  await expect(submit("teacher1", [rec(POSITION_T1_MAIN, "2027-02-01", "10:00", "12:00")])).rejects.toThrow(
    /leave_records_no_overlap|conflicting key/,
  );

  expect(await counts()).toEqual(before);
});

it("AC-LEAVE-16: конфлікт на одній даті скасовує всю заявку, на інших датах записів не лишається", async () => {
  await submit("teacher1", [rec(POSITION_T1_MAIN, "2027-02-02", "09:00", "11:00")]);
  const before = await counts();

  await expect(
    submit("teacher1", [
      rec(POSITION_T1_MAIN, "2027-02-03", "09:00", "11:00"),
      rec(POSITION_T1_MAIN, "2027-02-02", "10:00", "12:00"),
    ]),
  ).rejects.toThrow(/leave_records_no_overlap|conflicting key/);

  expect(await counts()).toEqual(before);
  const onFreeDate = await t.asService("select 1 from public.leave_records where leave_date = '2027-02-03'");
  expect(onFreeDate).toHaveLength(0);
});

it("AC-LEAVE-14: RLS віддає працівнику лише власні записи", async () => {
  await submit("teacher1", [rec(POSITION_T1_MAIN, "2027-03-02", "09:00", "10:00")]);
  await submit("teacher2", [rec(POSITION_T2_MAIN, "2027-03-03", "09:00", "10:00")]);

  for (const email of ["teacher1", "teacher2"]) {
    const rows = await t.asUser<{ employee_id: string }>(user(email), "select employee_id from public.leave_records");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.employee_id === user(email))).toBe(true);
  }
});

it("AC-LEAVE-17: коментар заявки доступний для всіх її записів (дві посади в один день)", async () => {
  await submit(
    "teacher1",
    [
      rec(POSITION_T1_MAIN, "2027-02-08", "09:00", "11:00"),
      rec(POSITION_T1_ADDITIONAL, "2027-02-08", "16:00", "16:30"),
    ],
    "Doctor's appointment",
  );

  const rows = await t.asUser<{ comment: string }>(
    user("teacher1"),
    `select q.comment from public.leave_records as r
     join public.leave_requests as q on q.id = r.request_id
     where r.leave_date = '2027-02-08'`,
  );

  expect(rows).toHaveLength(2);
  expect(rows.every((row) => row.comment === "Doctor's appointment")).toBe(true);
});

it("запис не може посилатися на чужу заявку (складений ключ request_id + employee_id)", async () => {
  const [request] = await t.asService<{ id: string }>(
    "insert into public.leave_requests (employee_id, leave_type) values ($1, 'sick') returning id",
    [user("teacher2")],
  );
  const before = await counts();

  await expect(
    t.asService(
      `insert into public.leave_records (request_id, employee_id, position_id, leave_date, starts_at, ends_at)
       values ($1, $2, $3, '2027-03-09', '09:00', '10:00')`,
      [request.id, user("teacher1"), POSITION_T1_MAIN],
    ),
  ).rejects.toThrow(/leave_records_request_owner_fkey|foreign key/);

  expect(await counts()).toEqual(before);
});

it("відвідувач без входу не викликає створення заявки", async () => {
  const before = await counts();

  await expect(
    t.asAnon("select public.create_leave_request('sick', $1::jsonb, null, null)", [
      JSON.stringify([rec(POSITION_T1_MAIN, "2027-03-10", "09:00", "10:00")]),
    ]),
  ).rejects.toThrow(/permission denied/);

  expect(await counts()).toEqual(before);
});

it("чужа посада: працівник не подає заявку на посаду іншого працівника", async () => {
  const before = await counts();

  await expect(submit("teacher2", [rec(POSITION_T1_MAIN, "2027-03-11", "09:00", "10:00")])).rejects.toThrow(/forbidden/);

  expect(await counts()).toEqual(before);
});
