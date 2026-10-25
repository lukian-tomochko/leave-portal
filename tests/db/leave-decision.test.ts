// Тести бази для рішення менеджера (вимога 02): PGlite застосовує наші міграції й сид, а запити йдуть від імені
// конкретних користувачів (роль authenticated). Кожен тест відмови перевіряє і саму відмову, і те, що дані не змінились.
import { afterAll, beforeAll, expect, it } from "vitest";
import { createLeaveDb, type LeaveDb } from "./supabase-pglite";

// Посади сиду (supabase/seed.sql): teacher1 — основна й додаткова, teacher2 — основна.
const POSITION_T1_MAIN = "00000000-0000-4000-8000-000000000101"; // менеджер manager1
const POSITION_T1_ADDITIONAL = "00000000-0000-4000-8000-000000000102"; // менеджер manager2
const POSITION_T2_MAIN = "00000000-0000-4000-8000-000000000103"; // менеджер manager1

type Outcome = { ok: boolean; status: string };

let t: LeaveDb;
let sequence = 0;

beforeAll(async () => {
  t = await createLeaveDb();
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

const user = (email: string) => t.users[`${email}@example.test`];

// Створює заявку й запис напряму (обхід RLS). Кожен запис — на власну дату, щоб не перетинатися в часі.
async function makeRecord(options: {
  employee: string;
  position: string;
  status?: string;
  startsAt?: string;
  endsAt?: string;
}): Promise<string> {
  sequence += 1;
  const date = new Date(Date.UTC(2027, 0, 1 + sequence)).toISOString().slice(0, 10);
  const [request] = await t.asService<{ id: string }>(
    "insert into public.leave_requests (employee_id, leave_type, comment) values ($1, 'sick', 'Doctor''s appointment') returning id",
    [user(options.employee)],
  );
  const [record] = await t.asService<{ id: string }>(
    `insert into public.leave_records (request_id, employee_id, position_id, leave_date, starts_at, ends_at, status)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      request.id,
      user(options.employee),
      options.position,
      date,
      options.startsAt ?? "08:30",
      options.endsAt ?? "15:30",
      options.status ?? "awaiting_decision",
    ],
  );
  return record.id;
}

const statusOf = async (id: string) =>
  (await t.asService<{ status: string }>("select status from public.leave_records where id = $1", [id]))[0].status;

const hoursOf = async (id: string) =>
  (
    await t.asService<{ hours: string }>(
      "select to_char(starts_at, 'HH24:MI') || '-' || to_char(ends_at, 'HH24:MI') as hours from public.leave_records where id = $1",
      [id],
    )
  )[0].hours;

const decisionCount = async (id: string) =>
  (await t.asService<{ n: number }>("select count(*)::int as n from public.leave_decisions where record_id = $1", [id]))[0].n;

async function decide(email: string, recordId: string, decision: string, comment?: string): Promise<Outcome> {
  const rows = await t.asUser<{ r: Outcome }>(
    user(email),
    "select public.decide_leave_record($1, $2, $3) as r",
    [recordId, decision, comment ?? null],
  );
  return rows[0].r;
}

async function updateHours(email: string, recordId: string, startsAt: string, endsAt: string): Promise<Outcome> {
  const rows = await t.asUser<{ r: Outcome }>(
    user(email),
    "select public.update_leave_record_hours($1, $2, $3) as r",
    [recordId, startsAt, endsAt],
  );
  return rows[0].r;
}

async function cancel(email: string, recordId: string): Promise<Outcome> {
  const rows = await t.asUser<{ r: Outcome }>(user(email), "select public.cancel_leave_record($1) as r", [recordId]);
  return rows[0].r;
}

it("AC-DECIDE-01: менеджер бачить лише записи своєї посади, не додаткової посади того ж працівника", async () => {
  const main = await makeRecord({ employee: "teacher1", position: POSITION_T1_MAIN });
  const additional = await makeRecord({ employee: "teacher1", position: POSITION_T1_ADDITIONAL, startsAt: "15:45", endsAt: "17:00" });

  const seen = await t.asUser<{ id: string }>(
    user("manager1"),
    "select id from public.leave_records where id = any($1::uuid[])",
    [[main, additional]],
  );

  expect(seen.map((row) => row.id)).toEqual([main]);
});

it("AC-DECIDE-04: повернення без коментаря не змінює статус і не пише рішення", async () => {
  const record = await makeRecord({ employee: "teacher1", position: POSITION_T1_MAIN });

  await expect(decide("manager1", record, "returned_for_revision")).rejects.toThrow(/comment_required/);
  await expect(decide("manager1", record, "returned_for_revision", "   ")).rejects.toThrow(/comment_required/);

  expect(await statusOf(record)).toBe("awaiting_decision");
  expect(await decisionCount(record)).toBe(0);
});

it("AC-DECIDE-07: другий менеджер після схвалення першого бачить поточний статус, а запис лишається схваленим", async () => {
  await t.asService(
    "insert into public.position_managers (position_id, manager_id) values ($1, $2) on conflict do nothing",
    [POSITION_T1_MAIN, user("manager2")],
  );
  const record = await makeRecord({ employee: "teacher1", position: POSITION_T1_MAIN });

  const first = await decide("manager1", record, "approved");
  const second = await decide("manager2", record, "rejected");

  expect(first).toEqual({ ok: true, status: "approved" });
  expect(second).toEqual({ ok: false, status: "approved" });
  expect(await statusOf(record)).toBe("approved");
  expect(await decisionCount(record)).toBe(1);

  await t.asService("delete from public.position_managers where position_id = $1 and manager_id = $2", [
    POSITION_T1_MAIN,
    user("manager2"),
  ]);
});

it("AC-DECIDE-08: менеджер, який не відповідає за посаду, не вирішує її запис", async () => {
  const record = await makeRecord({ employee: "teacher1", position: POSITION_T1_MAIN });

  await expect(decide("manager2", record, "approved")).rejects.toThrow(/forbidden/);

  expect(await statusOf(record)).toBe("awaiting_decision");
  expect(await decisionCount(record)).toBe(0);
});

it("AC-DECIDE-09: працівник без ролі менеджера не вирішує власний запис ні функцією, ні прямим оновленням", async () => {
  const record = await makeRecord({ employee: "teacher1", position: POSITION_T1_MAIN });

  await expect(decide("teacher1", record, "approved")).rejects.toThrow(/forbidden/);
  await expect(
    t.asUser(user("teacher1"), "update public.leave_records set status = 'approved' where id = $1", [record]),
  ).rejects.toThrow(/permission denied/);

  expect(await statusOf(record)).toBe("awaiting_decision");
  expect(await decisionCount(record)).toBe(0);
});

it("AC-DECIDE-10: адміністратор, який не відповідає за посаду, схвалює запис, і журнал показує адміністратора", async () => {
  const record = await makeRecord({ employee: "teacher2", position: POSITION_T2_MAIN });

  const outcome = await decide("admin", record, "approved");

  expect(outcome).toEqual({ ok: true, status: "approved" });
  expect(await statusOf(record)).toBe("approved");
  const [entry] = await t.asService<{ decided_by: string; decision: string }>(
    "select decided_by, decision from public.leave_decisions where record_id = $1",
    [record],
  );
  expect(entry).toEqual({ decided_by: user("admin"), decision: "approved" });
});

it("AC-DECIDE-12: працівник не змінює години схваленого запису", async () => {
  const record = await makeRecord({ employee: "teacher1", position: POSITION_T1_MAIN, status: "approved" });

  const outcome = await updateHours("teacher1", record, "09:00", "12:00");

  expect(outcome).toEqual({ ok: false, status: "approved" });
  expect(await hoursOf(record)).toBe("08:30-15:30");
  expect(await statusOf(record)).toBe("approved");
});

it("AC-DECIDE-17: скасований запис кінцевий і не повертається в роботу", async () => {
  const record = await makeRecord({ employee: "teacher1", position: POSITION_T1_MAIN, status: "returned_for_revision" });

  const cancelled = await cancel("teacher1", record);
  const resubmitted = await updateHours("teacher1", record, "09:00", "12:00");

  expect(cancelled).toEqual({ ok: true, status: "cancelled" });
  expect(resubmitted).toEqual({ ok: false, status: "cancelled" });
  expect(await statusOf(record)).toBe("cancelled");
  expect(await hoursOf(record)).toBe("08:30-15:30");
});

it("AC-DECIDE-18: менеджер не вирішує власний запис навіть як відповідальний за свою посаду", async () => {
  const [position] = await t.asService<{ id: string }>(
    `insert into public.positions (employee_id, kind, division, job_title)
     values ($1, 'main', 'Elementary school', 'Deputy teacher') returning id`,
    [user("manager1")],
  );
  await t.asService("insert into public.position_managers (position_id, manager_id) values ($1, $2)", [
    position.id,
    user("manager1"),
  ]);
  const record = await makeRecord({ employee: "manager1", position: position.id });

  await expect(decide("manager1", record, "approved")).rejects.toThrow(/own_record/);

  expect(await statusOf(record)).toBe("awaiting_decision");
  expect(await decisionCount(record)).toBe(0);
});

it("AC-DECIDE-19: власний запис менеджера схвалює адміністратор", async () => {
  const [position] = await t.asService<{ id: string }>(
    `insert into public.positions (employee_id, kind, division, job_title)
     values ($1, 'main', 'High school', 'Deputy math teacher') returning id`,
    [user("manager2")],
  );
  await t.asService("insert into public.position_managers (position_id, manager_id) values ($1, $2)", [
    position.id,
    user("manager2"),
  ]);
  const record = await makeRecord({ employee: "manager2", position: position.id });

  const outcome = await decide("admin", record, "approved");

  expect(outcome).toEqual({ ok: true, status: "approved" });
  expect(await statusOf(record)).toBe("approved");
});

it("AC-DECIDE-21: працівник не змінює тип відпустки запису напряму", async () => {
  const record = await makeRecord({ employee: "teacher1", position: POSITION_T1_MAIN });

  await expect(
    t.asUser(user("teacher1"), "update public.leave_requests set leave_type = 'personal' where employee_id = $1", [
      user("teacher1"),
    ]),
  ).rejects.toThrow(/permission denied/);

  const [row] = await t.asService<{ leave_type: string }>(
    `select q.leave_type from public.leave_requests as q
     join public.leave_records as r on r.request_id = q.id where r.id = $1`,
    [record],
  );
  expect(row.leave_type).toBe("sick");
});

it("AC-DECIDE-15: працівник бачить, хто вирішив його запис, а сторонні не бачать автора рішення", async () => {
  const record = await makeRecord({ employee: "teacher1", position: POSITION_T1_MAIN });
  await decide("manager1", record, "approved");

  const asEmployee = await t.asUser<{ full_name: string }>(
    user("teacher1"),
    "select full_name from public.profiles where id = $1",
    [user("manager1")],
  );
  const asOutsider = await t.asUser<{ full_name: string }>(
    user("teacher2"),
    "select full_name from public.profiles where id = $1",
    [user("manager1")],
  );
  const history = await t.asUser<{ decision: string; decided_by: string }>(
    user("teacher1"),
    "select decision, decided_by from public.leave_decisions where record_id = $1",
    [record],
  );

  expect(asEmployee).toHaveLength(1);
  expect(history).toEqual([{ decision: "approved", decided_by: user("manager1") }]);
  expect(asOutsider).toHaveLength(0);
});
