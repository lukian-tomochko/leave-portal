import { describe, expect, it } from "vitest";
import type { Closure } from "./closures";
import { LeaveConflictError, type LeaveRepository, type NewRequest } from "./repository";
import type { ExistingRecord, LeaveRecordView, Position } from "./types";
import { listMyRecords, previewRequest, submitRequest } from "./use-cases";
import { expectOk } from "../../../tests/support/expect-ok";

const MAIN: Position = {
  id: "main",
  kind: "main",
  division: "Elementary school",
  jobTitle: "Teacher",
  blocks: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "08:30", endsAt: "15:30" })),
};

// Фейк у пам'яті: рахує, скільки разів і з чим викликали createRequest.
function fakeRepository(options: {
  existing?: ExistingRecord[];
  // Для гонки: перший createRequest падає конфліктом, а наступне читання повертає ці записи.
  conflictOnCreate?: { existingAfter: ExistingRecord[] };
  // Закриття шкільного календаря для планування (вимога 04).
  closures?: Closure[];
  // Що поверне listRecords (фейк не фільтрує за власником, як це робить RLS).
  listed?: LeaveRecordView[];
}) {
  const created: NewRequest[] = [];
  let existing = options.existing ?? [];
  const repository: LeaveRepository = {
    loadPositions: async () => [MAIN],
    loadExistingRecords: async () => existing,
    loadClosures: async () => options.closures ?? [],
    createRequest: async (request) => {
      if (options.conflictOnCreate) {
        existing = options.conflictOnCreate.existingAfter;
        throw new LeaveConflictError();
      }
      created.push(request);
      return `request-${created.length}`;
    },
    listRecords: async () => options.listed ?? [],
  };
  return { repository, created };
}

const TWO_DATES = { leaveType: "sick" as const, dates: ["2026-11-02", "2026-11-03"], positionIds: ["main"] };

const view = (id: string, employeeId: string, date: string): LeaveRecordView => ({
  id,
  employeeId,
  date,
  startsAt: "08:30",
  endsAt: "15:30",
  status: "awaiting_decision",
  leaveType: "sick",
  positionLabel: "Elementary school / Teacher",
  comment: null,
  managerComment: null,
  split: null,
});

describe("My requests: коментар менеджера", () => {
  it("AC-DECIDE-24: у «My requests» працівник бачить статус «Approved» і коментар менеджера «Get well soon»", async () => {
    const { repository } = fakeRepository({
      listed: [{ ...view("t1-a", "teacher1", "2026-11-02"), status: "approved", managerComment: "Get well soon" }],
    });

    const records = await listMyRecords(repository, "teacher1");

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ status: "approved", managerComment: "Get well soon" });
  });
});

describe("закриття шкільного календаря в заявці", () => {
  const EARLY_DISMISSAL: Closure = { name: "Teachers' meeting", startsOn: "2026-11-20", endsOn: "2026-11-20", closedFrom: "12:00" };
  const WINTER_BREAK: Closure = { name: "Winter break", startsOn: "2026-12-28", endsOn: "2027-01-08", closedFrom: null };

  it("AC-CAL-04: цілий день на скороченому дні створює 1 запис 08:30–12:00", async () => {
    const { repository, created } = fakeRepository({ closures: [EARLY_DISMISSAL] });

    const outcome = await submitRequest(repository, "employee-1", { leaveType: "personal", dates: ["2026-11-20"], positionIds: ["main"] });

    expect(outcome).toEqual({ ok: true, requestId: "request-1" });
    expect(created[0].records.map((r) => [r.date, r.startsAt, r.endsAt])).toEqual([["2026-11-20", "08:30", "12:00"]]);
  });

  it("AC-CAL-03: закрита дата в підсумку відкинута з назвою закриття, а відкрита лишається", async () => {
    const { repository } = fakeRepository({ closures: [WINTER_BREAK] });

    const outcome = await previewRequest(repository, "employee-1", {
      leaveType: "sick",
      dates: ["2026-12-29", "2027-01-12"],
      positionIds: ["main"],
    });

    expect(outcome).toMatchObject({ ok: true, skippedClosed: [{ date: "2026-12-29", name: "Winter break" }] });
    expect(expectOk(outcome).records.map((r) => r.date)).toEqual(["2027-01-12"]);
  });

  it("AC-CAL-03: єдина закрита дата — заявки немає, працівник бачить «The school is closed on this day: Winter break»", async () => {
    const { repository, created } = fakeRepository({ closures: [WINTER_BREAK] });

    const outcome = await submitRequest(repository, "employee-1", { leaveType: "sick", dates: ["2026-12-29"], positionIds: ["main"] });

    expect(outcome).toEqual({ ok: false, code: "SCHOOL_CLOSED", message: "The school is closed on this day: Winter break" });
    expect(created).toHaveLength(0);
  });
});

describe("My requests", () => {
  it("AC-LEAVE-14: teacher1 бачить лише свої 2 записи, навіть якщо репозиторій повернув і 3 записи teacher2", async () => {
    const { repository } = fakeRepository({
      listed: [
        view("t1-a", "teacher1", "2026-11-02"),
        view("t2-a", "teacher2", "2026-11-02"),
        view("t1-b", "teacher1", "2026-11-03"),
        view("t2-b", "teacher2", "2026-11-03"),
        view("t2-c", "teacher2", "2026-11-04"),
      ],
    });

    const mine = await listMyRecords(repository, "teacher1");

    expect(mine.map((record) => record.id)).toEqual(["t1-a", "t1-b"]);
    // Кожен запис несе дату, години, посаду, тип і статус для показу.
    expect(mine[0]).toMatchObject({
      date: "2026-11-02",
      startsAt: "08:30",
      endsAt: "15:30",
      positionLabel: "Elementary school / Teacher",
      leaveType: "sick",
      status: "awaiting_decision",
    });
  });
});

describe("сценарії над репозиторієм", () => {
  it("AC-LEAVE-05: дві дати створюються однією заявкою з двома записами", async () => {
    const { repository, created } = fakeRepository({});

    const outcome = await submitRequest(repository, "employee-1", TWO_DATES);

    expect(outcome).toEqual({ ok: true, requestId: "request-1" });
    expect(created).toHaveLength(1);
    expect(created[0].records.map((r) => r.date)).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("підтвердження заявки на п'ятницю й суботу створює один запис на п'ятницю, а субота в підсумку позначена", async () => {
    const { repository, created } = fakeRepository({});
    const input = { leaveType: "sick" as const, dates: ["2026-11-06", "2026-11-07"], positionIds: ["main"] };

    const preview = await previewRequest(repository, "employee-1", input);
    const outcome = await submitRequest(repository, "employee-1", input);

    expect(preview).toMatchObject({ ok: true, skippedDates: ["2026-11-07"] });
    expect(outcome).toEqual({ ok: true, requestId: "request-1" });
    expect(created[0].records.map((record) => record.date)).toEqual(["2026-11-06"]);
  });

  it("AC-LEAVE-11: підсумок нічого не створює, поки заявку не підтверджено", async () => {
    const { repository, created } = fakeRepository({});

    const outcome = await previewRequest(repository, "employee-1", TWO_DATES);

    const outcomeOk = expectOk(outcome);
    expect(outcomeOk.records).toHaveLength(2);
    expect(created).toHaveLength(0);
  });

  it("AC-LEAVE-16: за конфлікту на одній даті заявка не створюється взагалі", async () => {
    const { repository, created } = fakeRepository({
      existing: [{ positionId: "main", date: "2026-11-03", startsAt: "09:00", endsAt: "11:00", status: "awaiting_decision" }],
    });

    const outcome = await submitRequest(repository, "employee-1", TWO_DATES);

    expect(outcome).toEqual({
      ok: false,
      code: "TIME_CONFLICT",
      message: "You already have a request for this time: 2026-11-03 09:00–11:00",
    });
    expect(created).toHaveLength(0);
  });

  it("підтвердження передає коментар і спорідненість у створення заявки, а підсумок показує коментар", async () => {
    const { repository, created } = fakeRepository({});
    const input = { ...TWO_DATES, leaveType: "family" as const, relationship: "sibling" as const, comment: "Doctor's appointment" };

    const preview = await previewRequest(repository, "employee-1", input);
    const outcome = await submitRequest(repository, "employee-1", input);

    expect(preview).toMatchObject({ ok: true, comment: "Doctor's appointment" });
    expect(outcome).toEqual({ ok: true, requestId: "request-1" });
    expect(created[0]).toMatchObject({ leaveType: "family", relationship: "sibling", comment: "Doctor's appointment" });
    expect(created[0].records.map((record) => record.comment)).toEqual(["Doctor's appointment", "Doctor's appointment"]);
  });

  it("за задовгого коментаря заявка не створюється", async () => {
    const { repository, created } = fakeRepository({});

    const outcome = await submitRequest(repository, "employee-1", { ...TWO_DATES, comment: "a".repeat(501) });

    expect(outcome).toEqual({ ok: false, code: "COMMENT_TOO_LONG", message: "The comment can be at most 500 characters" });
    expect(created).toHaveLength(0);
  });

  it("Family celebration без спорідненості не створює заявки", async () => {
    const { repository, created } = fakeRepository({});

    const outcome = await submitRequest(repository, "employee-1", { ...TWO_DATES, leaveType: "family" });

    expect(outcome).toMatchObject({ ok: false, code: "RELATIONSHIP_REQUIRED" });
    expect(created).toHaveLength(0);
  });

  it("гонка: коли база відхилила заявку через перетин, людина бачить повідомлення PM про конфліктний запис", async () => {
    const { repository, created } = fakeRepository({
      conflictOnCreate: {
        existingAfter: [{ positionId: "main", date: "2026-11-02", startsAt: "08:30", endsAt: "15:30", status: "awaiting_decision" }],
      },
    });

    const outcome = await submitRequest(repository, "employee-1", TWO_DATES);

    expect(outcome).toEqual({
      ok: false,
      code: "TIME_CONFLICT",
      message: "You already have a request for this time: 2026-11-02 08:30–15:30",
    });
    expect(created).toHaveLength(0);
  });
});
