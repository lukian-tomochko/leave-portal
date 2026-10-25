import { describe, expect, it, vi } from "vitest";
import type { DecideResult } from "./decision";
import {
  RECORD_NOT_EDITABLE,
  cancelRecord,
  changeHours,
  type EmployeeRecordRepository,
  type OwnRecord,
  type OwnRecordContext,
} from "./employee-record";
import { LeaveConflictError } from "./repository";
import type { Position, RecordStatus } from "./types";

// Дані з прикладів PM (requirements/02-leave-decision.md): основна посада, розклад Mon–Fri 08:30–15:30, 2026-11-02 — понеділок.
const MAIN: Position = {
  id: "pos-main",
  kind: "main",
  division: "Elementary school",
  jobTitle: "Teacher",
  blocks: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "08:30", endsAt: "15:30" })),
};

function ownRecord(overrides: Partial<OwnRecord> = {}): OwnRecord {
  return {
    id: "r1",
    employeeId: "teacher1",
    positionId: MAIN.id,
    date: "2026-11-02",
    startsAt: "08:30",
    endsAt: "15:30",
    status: "awaiting_decision",
    leaveType: "sick",
    ...overrides,
  };
}

// Фейк порту: повторює правила функцій бази update_leave_record_hours і cancel_leave_record, але в пам'яті.
function fakeRepository(
  record: OwnRecord,
  others: { date: string; startsAt: string; endsAt: string }[] = [],
  options: { conflictOnUpdate?: boolean } = {},
) {
  const current = { ...record };
  const EDITABLE: RecordStatus[] = ["awaiting_decision", "returned_for_revision"];
  const updateHours = vi.fn(async (_id: string, startsAt: string, endsAt: string): Promise<DecideResult> => {
    if (options.conflictOnUpdate) {
      throw new LeaveConflictError();
    }
    if (!EDITABLE.includes(current.status)) {
      return { ok: false, status: current.status };
    }
    current.startsAt = startsAt;
    current.endsAt = endsAt;
    current.status = "awaiting_decision";
    return { ok: true, status: current.status };
  });
  const cancel = vi.fn(async (): Promise<DecideResult> => {
    if (!EDITABLE.includes(current.status)) {
      return { ok: false, status: current.status };
    }
    current.status = "cancelled";
    return { ok: true, status: current.status };
  });
  const repository: EmployeeRecordRepository = {
    getOwnRecord: async (employeeId, recordId): Promise<OwnRecordContext | null> =>
      employeeId === current.employeeId && recordId === current.id ? { record: { ...current }, position: MAIN, others } : null,
    updateHours,
    cancel,
  };
  return { repository, updateHours, cancel, current };
}

describe("зміна годин власного запису", () => {
  it("AC-DECIDE-16: працівник змінює години запису, що чекає рішення, на 09:00–12:00, статус лишається «Awaiting decision»", async () => {
    const { repository, current } = fakeRepository(ownRecord());

    const outcome = await changeHours(repository, "teacher1", { recordId: "r1", startsAt: "09:00", endsAt: "12:00" });

    expect(outcome).toEqual({ ok: true, status: "awaiting_decision" });
    expect(current).toMatchObject({ startsAt: "09:00", endsAt: "12:00", status: "awaiting_decision", positionId: "pos-main" });
  });

  it("AC-DECIDE-06: повернений запис після зміни годин і повторного подання знову чекає рішення тієї ж посади", async () => {
    const { repository, current } = fakeRepository(ownRecord({ status: "returned_for_revision" }));

    const outcome = await changeHours(repository, "teacher1", { recordId: "r1", startsAt: "09:00", endsAt: "12:00" });

    expect(outcome).toEqual({ ok: true, status: "awaiting_decision" });
    expect(current).toMatchObject({ startsAt: "09:00", endsAt: "12:00", status: "awaiting_decision", positionId: "pos-main" });
  });

  it("AC-DECIDE-12: працівник не змінює години схваленого запису й бачить «This record is already approved and cannot be changed»", async () => {
    const { repository, updateHours, current } = fakeRepository(ownRecord({ status: "approved" }));

    const outcome = await changeHours(repository, "teacher1", { recordId: "r1", startsAt: "09:00", endsAt: "12:00" });

    expect(outcome).toEqual({
      ok: false,
      code: "ALREADY_APPROVED",
      message: "This record is already approved and cannot be changed",
    });
    expect(updateHours).not.toHaveBeenCalled();
    expect(current).toMatchObject({ startsAt: "08:30", endsAt: "15:30", status: "approved" });
  });

  it("AC-DECIDE-21: спроба змінити тип відпустки не зберігається, працівник бачить текст PM, запис незмінний", async () => {
    const { repository, updateHours, current } = fakeRepository(ownRecord());

    const outcome = await changeHours(repository, "teacher1", {
      recordId: "r1",
      startsAt: "09:00",
      endsAt: "12:00",
      requested: { leaveType: "personal" },
    });

    expect(outcome).toEqual({
      ok: false,
      code: "ONLY_HOURS",
      message:
        "Only the hours can be changed. To change the date, position or leave type, cancel this record and submit a new request",
    });
    expect(updateHours).not.toHaveBeenCalled();
    expect(current).toMatchObject({ startsAt: "08:30", endsAt: "15:30", leaveType: "sick" });
  });

  it("AC-DECIDE-21: спроба змінити дату чи посаду так само відхиляється, а той самий тип відпустки не заважає", async () => {
    const { repository, updateHours } = fakeRepository(ownRecord());

    const date = await changeHours(repository, "teacher1", {
      recordId: "r1",
      startsAt: "09:00",
      endsAt: "12:00",
      requested: { date: "2026-11-03" },
    });
    const position = await changeHours(repository, "teacher1", {
      recordId: "r1",
      startsAt: "09:00",
      endsAt: "12:00",
      requested: { positionId: "other-position" },
    });
    const same = await changeHours(repository, "teacher1", {
      recordId: "r1",
      startsAt: "09:00",
      endsAt: "12:00",
      requested: { leaveType: "sick", date: "2026-11-02", positionId: "pos-main" },
    });

    expect(date.ok === false && date.code).toBe("ONLY_HOURS");
    expect(position.ok === false && position.code).toBe("ONLY_HOURS");
    expect(same.ok).toBe(true);
    expect(updateHours).toHaveBeenCalledTimes(1);
  });

  it("AC-DECIDE-22: перетин з іншим записом тієї ж посади не зберігається, працівник бачить «You already have a request for this time: 2026-11-02 08:30–10:00»", async () => {
    const second = ownRecord({ startsAt: "13:00", endsAt: "15:30" });
    const { repository, updateHours, current } = fakeRepository(second, [
      { date: "2026-11-02", startsAt: "08:30", endsAt: "10:00" },
    ]);

    const outcome = await changeHours(repository, "teacher1", { recordId: "r1", startsAt: "09:00", endsAt: "15:30" });

    expect(outcome).toEqual({
      ok: false,
      code: "TIME_CONFLICT",
      message: "You already have a request for this time: 2026-11-02 08:30–10:00",
    });
    expect(updateHours).not.toHaveBeenCalled();
    expect(current).toMatchObject({ startsAt: "13:00", endsAt: "15:30" });
  });

  it("години поза розкладом відхиляються текстом PM із вимоги 01, нічого не зберігається", async () => {
    const { repository, updateHours } = fakeRepository(ownRecord());

    const outcome = await changeHours(repository, "teacher1", { recordId: "r1", startsAt: "07:30", endsAt: "09:00" });

    expect(outcome).toEqual({
      ok: false,
      code: "INVALID_HOURS",
      message: "Hours must be within your schedule: 08:30–15:30",
    });
    expect(updateHours).not.toHaveBeenCalled();
  });

  it("гонка: коли база відхилила зміну через перетин, працівник бачить повідомлення PM про конфліктний запис", async () => {
    const others = [{ date: "2026-11-02", startsAt: "08:30", endsAt: "10:00" }];
    const { repository } = fakeRepository(ownRecord({ startsAt: "13:00", endsAt: "15:30" }), [], { conflictOnUpdate: true });
    // Після відмови бази свіже читання вже містить конфліктний запис.
    let calls = 0;
    const original = repository.getOwnRecord;
    repository.getOwnRecord = async (employeeId, recordId) => {
      const context = await original(employeeId, recordId);
      calls += 1;
      return context && calls > 1 ? { ...context, others } : context;
    };

    const outcome = await changeHours(repository, "teacher1", { recordId: "r1", startsAt: "09:00", endsAt: "15:30" });

    expect(outcome.ok === false && outcome.message).toBe("You already have a request for this time: 2026-11-02 08:30–10:00");
  });

  it("чужий запис не знаходиться й не змінюється", async () => {
    const { repository, updateHours } = fakeRepository(ownRecord());

    const outcome = await changeHours(repository, "teacher2", { recordId: "r1", startsAt: "09:00", endsAt: "12:00" });

    expect(outcome.ok === false && outcome.code).toBe("NOT_FOUND");
    expect(updateHours).not.toHaveBeenCalled();
  });
});

describe("скасування власного запису", () => {
  it("AC-DECIDE-13: працівник скасовує запис, що чекає рішення, і той стає «Cancelled»", async () => {
    const { repository, current } = fakeRepository(ownRecord());

    const outcome = await cancelRecord(repository, "teacher1", "r1");

    expect(outcome).toEqual({ ok: true, status: "cancelled" });
    expect(current.status).toBe("cancelled");
  });

  it("AC-DECIDE-17: повернений запис скасовується й більше не повертається в роботу", async () => {
    const { repository, updateHours, current } = fakeRepository(ownRecord({ status: "returned_for_revision" }));

    const cancelled = await cancelRecord(repository, "teacher1", "r1");
    const resubmitted = await changeHours(repository, "teacher1", { recordId: "r1", startsAt: "09:00", endsAt: "12:00" });

    expect(cancelled).toEqual({ ok: true, status: "cancelled" });
    expect(resubmitted).toEqual({ ok: false, code: "NOT_EDITABLE", message: RECORD_NOT_EDITABLE });
    // Домен відмовляє сам, до функції бази: друга перевірка (база) не маскує послаблення першої.
    expect(updateHours).not.toHaveBeenCalled();
    expect(current).toMatchObject({ status: "cancelled", startsAt: "08:30", endsAt: "15:30" });
  });

  it("схвалений запис працівник не скасовує (скасування схваленого — WS11), статус не змінюється", async () => {
    const { repository, cancel, current } = fakeRepository(ownRecord({ status: "approved" }));

    const outcome = await cancelRecord(repository, "teacher1", "r1");

    expect(outcome.ok).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
    expect(current.status).toBe("approved");
  });
});
