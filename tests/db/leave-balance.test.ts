// Тести бази для балансів (вимога 03): PGlite застосовує наші міграції й сид, а запити йдуть від імені конкретних
// користувачів. Розрахунок балансу тестується без бази (src/lib/leave/balance.test.ts); тут — що саме база віддає й кому.
import { afterAll, beforeAll, expect, it } from "vitest";
import { createLeaveDb, type LeaveDb } from "./supabase-pglite";

const POSITION_T1_MAIN = "00000000-0000-4000-8000-000000000101"; // менеджер manager1
const POSITION_T1_ADDITIONAL = "00000000-0000-4000-8000-000000000102"; // менеджер manager2
const POSITION_PM = "00000000-0000-4000-8000-000000000104"; // pm-employee, менеджер pm-manager

type Inputs = {
  positions: { id: string; blocks: { weekday: number }[] }[];
  records: { id: string; leave_type: string; paid_share: string | null; unpaid_share: string }[];
};

let t: LeaveDb;
let sequence = 0;

beforeAll(async () => {
  t = await createLeaveDb();
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

const user = (email: string) => t.users[`${email}@example.test`];

// n-й робочий день після 2027-01-04: записи на різні дати не перетинаються.
function nthWorkday(n: number): string {
  const day = new Date(Date.UTC(2027, 0, 4));
  for (let counted = 0; counted < n; ) {
    day.setUTCDate(day.getUTCDate() + 1);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      counted += 1;
    }
  }
  return day.toISOString().slice(0, 10);
}

async function makeRecord(employee: string, position: string, leaveType = "personal", status = "awaiting_decision") {
  sequence += 1;
  const [request] = await t.asService<{ id: string }>(
    "insert into public.leave_requests (employee_id, leave_type) values ($1, $2) returning id",
    [user(employee), leaveType],
  );
  const [record] = await t.asService<{ id: string }>(
    `insert into public.leave_records (request_id, employee_id, position_id, leave_date, starts_at, ends_at, status)
     values ($1, $2, $3, $4, '08:30', '15:30', $5) returning id`,
    [request.id, user(employee), position, nthWorkday(sequence), status],
  );
  return record.id;
}

async function inputsFor(viewer: string, employee: string): Promise<Inputs> {
  const rows = await t.asUser<{ r: Inputs }>(user(viewer), "select public.employee_balance_inputs($1) as r", [user(employee)]);
  return rows[0].r;
}

const decide = (viewer: string, record: string, decision: string, comment: string | null, paid: number | null, unpaid: number) =>
  t.asUser<{ r: { ok: boolean; status: string } }>(
    user(viewer),
    "select public.decide_leave_record($1, $2, $3, $4, $5) as r",
    [record, decision, comment, paid, unpaid],
  );

it("AC-BALANCE-04: запис «Awaiting decision» не потрапляє у вхідні дані балансу працівника", async () => {
  const record = await makeRecord("teacher1", POSITION_T1_MAIN);

  const inputs = await inputsFor("teacher1", "teacher1");

  expect(inputs.records.map((item) => item.id)).not.toContain(record);
});

it("AC-BALANCE-07: відхилений запис не потрапляє у вхідні дані балансу, схвалений потрапляє", async () => {
  const rejected = await makeRecord("teacher1", POSITION_T1_MAIN, "sick");
  const approved = await makeRecord("teacher1", POSITION_T1_MAIN, "sick");

  await decide("manager1", rejected, "rejected", null, null, 0);
  await decide("manager1", approved, "approved", null, null, 0);
  const ids = (await inputsFor("teacher1", "teacher1")).records.map((item) => item.id);

  expect(ids).not.toContain(rejected);
  expect(ids).toContain(approved);
});

it("AC-BALANCE-12: менеджер, який не керує жодною посадою працівника, не отримує його баланс", async () => {
  await makeRecord("pm-employee", POSITION_PM, "personal", "approved");

  await expect(inputsFor("manager1", "pm-employee")).rejects.toThrow(/forbidden/);
});

it("AC-BALANCE-13: працівник не отримує баланс іншого працівника", async () => {
  await makeRecord("teacher2", POSITION_T1_MAIN, "personal", "approved");

  await expect(inputsFor("teacher1", "teacher2")).rejects.toThrow(/forbidden/);
  await expect(t.asAnon("select public.employee_balance_inputs($1) as r", [user("teacher2")])).rejects.toThrow(/permission denied/);
});

it("AC-BALANCE-20: менеджер додаткової посади бачить повний баланс працівника, зокрема схвалені записи основної посади", async () => {
  const onMain = await makeRecord("teacher1", POSITION_T1_MAIN, "personal", "approved");

  const asManager2 = await inputsFor("manager2", "teacher1");
  const asEmployee = await inputsFor("teacher1", "teacher1");

  expect(asManager2.records.map((item) => item.id)).toContain(onMain);
  expect(asManager2.records.map((item) => item.id).sort()).toEqual(asEmployee.records.map((item) => item.id).sort());
  expect(asManager2.positions.map((item) => item.id).sort()).toEqual([POSITION_T1_ADDITIONAL, POSITION_T1_MAIN].sort());
});

it("AC-BALANCE-10: схвалення з розподілом зберігає частки 0.50 і 0.50, які бачить працівник", async () => {
  const record = await makeRecord("teacher1", POSITION_T1_MAIN, "personal");

  const rows = await decide("manager1", record, "approved", null, 0.5, 0.5);
  const stored = (await inputsFor("teacher1", "teacher1")).records.find((item) => item.id === record);

  expect(rows[0].r).toEqual({ ok: true, status: "approved" });
  expect(Number(stored?.paid_share)).toBe(0.5);
  expect(Number(stored?.unpaid_share)).toBe(0.5);
});

it("розподіл можливий лише при схваленні й у межах одного дня, дані не змінюються", async () => {
  const record = await makeRecord("teacher1", POSITION_T1_MAIN, "personal");

  await expect(decide("manager1", record, "rejected", null, 0.5, 0.5)).rejects.toThrow(/invalid split/);
  await expect(decide("manager1", record, "approved", null, null, 1.5)).rejects.toThrow(/invalid split/);

  const [row] = await t.asService<{ status: string; unpaid_share: string }>(
    "select status, unpaid_share from public.leave_records where id = $1",
    [record],
  );
  expect(row.status).toBe("awaiting_decision");
  expect(Number(row.unpaid_share)).toBe(0);
});
