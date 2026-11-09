// Тести бази для закриттів школи в заявках (вимога 03): створення й зміна годин запису в обхід застосунку не
// повинні приймати закритий час. Закриття додає й видаляє адміністратор через public.add_school_closure /
// public.remove_school_closure; закриття глобальні в спільній базі PGlite, тому після кожного тесту їх чистимо разом із
// заявками, створеними тестом. Кожен тест відмови перевіряє і саму відмову, і те, що дані не змінились.
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createLeaveDb, type LeaveDb } from "./supabase-pglite";

// Посада сиду (supabase/seed.sql): teacher1 — основна пн–пт 08:30–15:30.
const POSITION_T1_MAIN = "00000000-0000-4000-8000-000000000101";

type RecordInput = { position_id: string; leave_date: string; starts_at: string; ends_at: string };
type Hours = { starts_at: string; ends_at: string };

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
const rec = (leave_date: string, starts_at: string, ends_at: string): RecordInput => ({
  position_id: POSITION_T1_MAIN,
  leave_date,
  starts_at,
  ends_at,
});

async function addClosure(name: string, startsOn: string, endsOn: string, closedFrom: string | null = null): Promise<string> {
  const rows = await t.asUser<{ r: { ok: boolean; id: string } }>(
    user("admin"),
    "select public.add_school_closure($1, $2::date, $3::date, $4::time) as r",
    [name, startsOn, endsOn, closedFrom],
  );
  expect(rows[0].r.ok).toBe(true);
  return rows[0].r.id;
}

async function removeClosure(id: string): Promise<void> {
  await t.asUser(user("admin"), "select public.remove_school_closure($1::uuid) as r", [id]);
}

// Закриття напряму (обхід add_school_closure, яка б відмовила через наявні записи): для тестів зміни годин.
async function seedClosure(name: string, startsOn: string, endsOn: string): Promise<void> {
  await t.db.query(
    "insert into public.school_closures (name, starts_on, ends_on, created_by) values ($1, $2, $3, $4)",
    [name, startsOn, endsOn, user("admin")],
  );
}

async function submit(records: RecordInput[]): Promise<string> {
  const rows = await t.asUser<{ id: string }>(
    user("teacher1"),
    "select public.create_leave_request('personal', $1::jsonb, null, null) as id",
    [JSON.stringify(records)],
  );
  requestIds.push(rows[0].id);
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

const hoursOn = (date: string) =>
  t.asService<Hours>(
    `select to_char(starts_at, 'HH24:MI') as starts_at, to_char(ends_at, 'HH24:MI') as ends_at
       from public.leave_records where leave_date = $1 order by starts_at`,
    [date],
  );

async function recordIdOn(date: string): Promise<string> {
  const rows = await t.asService<{ id: string }>("select id from public.leave_records where leave_date = $1", [date]);
  return rows[0].id;
}

const changeHours = (id: string, startsAt: string, endsAt: string) =>
  t.asUser(user("teacher1"), "select public.update_leave_record_hours($1, $2::time, $3::time) as r", [id, startsAt, endsAt]);

it("AC-CAL-03: пряме створення заявки на 2026-12-29 у «Winter break» відхиляється, нічого не створено", async () => {
  await addClosure("Winter break", "2026-12-28", "2027-01-08");
  const before = await counts();

  await expect(submit([rec("2026-12-29", "08:30", "15:30")])).rejects.toThrow(/school_closed/);

  expect(await counts()).toEqual(before);
  expect(await hoursOn("2026-12-29")).toEqual([]);
});

it("AC-CAL-03: години всередині закритого дня теж відхиляються як school_closed", async () => {
  await addClosure("Winter break", "2026-12-28", "2027-01-08");
  const before = await counts();

  await expect(submit([rec("2026-12-29", "09:00", "11:00")])).rejects.toThrow(/school_closed/);

  expect(await counts()).toEqual(before);
});

it("AC-CAL-03: перший і останній день закриття (2026-12-28, 2027-01-08) теж закриті", async () => {
  await addClosure("Winter break", "2026-12-28", "2027-01-08");
  const before = await counts();

  await expect(submit([rec("2026-12-28", "08:30", "15:30")])).rejects.toThrow(/school_closed/);
  await expect(submit([rec("2027-01-08", "08:30", "15:30")])).rejects.toThrow(/school_closed/);

  expect(await counts()).toEqual(before);
});

it("AC-CAL-03: закрита дата скасовує всю заявку, на відкритій даті 2027-01-12 записів не лишається", async () => {
  await addClosure("Winter break", "2026-12-28", "2027-01-08");
  const before = await counts();

  await expect(submit([rec("2027-01-12", "08:30", "15:30"), rec("2026-12-29", "08:30", "15:30")])).rejects.toThrow(
    /school_closed/,
  );

  expect(await counts()).toEqual(before);
  expect(await hoursOn("2027-01-12")).toEqual([]);
});

it("AC-CAL-04: при достроковому закритті з 12:00 запис 08:30–12:00 на 2026-11-20 створюється", async () => {
  await addClosure("Teachers' meeting", "2026-11-20", "2026-11-20", "12:00");

  await submit([rec("2026-11-20", "08:30", "12:00")]);

  expect(await hoursOn("2026-11-20")).toEqual([{ starts_at: "08:30", ends_at: "12:00" }]);
});

it("AC-CAL-05: години 13:00–14:00 при достроковому закритті з 12:00 відхиляються, нічого не створено", async () => {
  await addClosure("Teachers' meeting", "2026-11-20", "2026-11-20", "12:00");
  const before = await counts();

  await expect(submit([rec("2026-11-20", "13:00", "14:00")])).rejects.toThrow(/hours_outside_schedule/);

  expect(await counts()).toEqual(before);
  expect(await hoursOn("2026-11-20")).toEqual([]);
});

it("AC-CAL-05: увесь розклад 08:30–15:30 при достроковому закритті з 12:00 відхиляється", async () => {
  await addClosure("Teachers' meeting", "2026-11-20", "2026-11-20", "12:00");
  const before = await counts();

  await expect(submit([rec("2026-11-20", "08:30", "15:30")])).rejects.toThrow(/hours_outside_schedule/);

  expect(await counts()).toEqual(before);
});

it("AC-CAL-05: години 11:00–13:00, що перетинають час закриття 12:00, відхиляються", async () => {
  await addClosure("Teachers' meeting", "2026-11-20", "2026-11-20", "12:00");
  const before = await counts();

  await expect(submit([rec("2026-11-20", "11:00", "13:00")])).rejects.toThrow(/hours_outside_schedule/);

  expect(await counts()).toEqual(before);
});

it("AC-CAL-05: зміна годин наявного запису на 13:00–14:00 після закриття з 12:00 відхиляється, години не змінюються", async () => {
  // Запис створено до закриття (2026-11-23 — понеділок); 09:00–10:00 раніше за 12:00, тож закриття додається.
  await submit([rec("2026-11-23", "09:00", "10:00")]);
  const id = await recordIdOn("2026-11-23");
  await addClosure("Teachers' meeting", "2026-11-23", "2026-11-23", "12:00");

  await expect(changeHours(id, "13:00", "14:00")).rejects.toThrow(/hours_outside_schedule/);

  expect(await hoursOn("2026-11-23")).toEqual([{ starts_at: "09:00", ends_at: "10:00" }]);
});

it("AC-CAL-05: зміна годин наявного запису на 11:00–13:00, що виходить за час закриття 12:00, відхиляється, години не змінюються", async () => {
  // Початок 11:00 ще в відкритій частині дня, але кінець 13:00 уже після закриття: відхиляється саме через кінець.
  await submit([rec("2026-11-30", "09:00", "10:00")]);
  const id = await recordIdOn("2026-11-30");
  await addClosure("Teachers' meeting", "2026-11-30", "2026-11-30", "12:00");

  await expect(changeHours(id, "11:00", "13:00")).rejects.toThrow(/hours_outside_schedule/);

  expect(await hoursOn("2026-11-30")).toEqual([{ starts_at: "09:00", ends_at: "10:00" }]);
});

it("AC-CAL-03: зміна годин наявного запису на дату, закриту на цілий день, відхиляється, години не змінюються", async () => {
  // Запис створено до закриття (2026-11-24 — вівторок); закриття вставлено напряму, бо add_school_closure
  // відмовила б через цей запис (AC-CAL-07).
  await submit([rec("2026-11-24", "09:00", "10:00")]);
  const id = await recordIdOn("2026-11-24");
  await seedClosure("Staff day", "2026-11-24", "2026-11-24");

  await expect(changeHours(id, "09:00", "11:00")).rejects.toThrow(/school_closed/);

  expect(await hoursOn("2026-11-24")).toEqual([{ starts_at: "09:00", ends_at: "10:00" }]);
});

it("AC-CAL-09: після видалення «Winter break» дата 2026-12-29 приймається з годинами 08:30–15:30", async () => {
  const id = await addClosure("Winter break", "2026-12-28", "2027-01-08");
  await expect(submit([rec("2026-12-29", "08:30", "15:30")])).rejects.toThrow(/school_closed/);

  await removeClosure(id);
  await submit([rec("2026-12-29", "08:30", "15:30")]);

  expect(await hoursOn("2026-12-29")).toEqual([{ starts_at: "08:30", ends_at: "15:30" }]);
});
