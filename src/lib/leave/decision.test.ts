import { describe, expect, it, vi } from "vitest";
import {
  DecisionDeniedError,
  type Actor,
  type DecideResult,
  type Decision,
  type DecisionRecord,
  type DecisionRepository,
  PAGE_SIZE,
  awaitingEmptyMessage,
  decideRecord,
  formatDecisionLine,
  getRecord,
  isRecordId,
  listAwaiting,
  listHistory,
  parsePage,
} from "./decision";

// Дані з прикладів PM (requirements/02-leave-decision.md): teacher1 має основну посаду (manager1) і додаткову (manager2).
const POSITION_MAIN = "pos-main";
const POSITION_ADDITIONAL = "pos-additional";

const MANAGER1: Actor = { id: "manager1", role: "manager", managedPositionIds: [POSITION_MAIN] };
const MANAGER2: Actor = { id: "manager2", role: "manager", managedPositionIds: [POSITION_ADDITIONAL] };
const ADMIN: Actor = { id: "admin", role: "admin", managedPositionIds: [] };

function record(overrides: Partial<DecisionRecord> & { id: string }): DecisionRecord {
  return {
    employeeId: "teacher1",
    employeeName: "Teacher One",
    positionId: POSITION_MAIN,
    positionLabel: "Elementary school / Teacher",
    date: "2026-11-02",
    startsAt: "08:30",
    endsAt: "15:30",
    leaveType: "sick",
    status: "awaiting_decision",
    requestComment: null,
    entries: [],
    ...overrides,
  };
}

// Фейк порту: повторює правила функції бази decide_leave_record (права, статус), але в пам'яті.
// Фейк віддає ВСІ записи, щоб тести домену перевіряли власний захисний фільтр, а не фільтр бази.
function fakeRepository(records: DecisionRecord[], currentUser: Actor, names: Record<string, string> = {}) {
  const decide = vi.fn(async (recordId: string, decision: Decision, comment: string | null): Promise<DecideResult> => {
    const target = records.find((item) => item.id === recordId);
    if (!target) {
      throw new DecisionDeniedError("forbidden");
    }
    if (currentUser.role === "employee") {
      throw new DecisionDeniedError("forbidden");
    }
    if (currentUser.role === "manager") {
      if (!currentUser.managedPositionIds.includes(target.positionId)) {
        throw new DecisionDeniedError("forbidden");
      }
      if (target.employeeId === currentUser.id) {
        throw new DecisionDeniedError("own_record");
      }
    }
    if (target.status !== "awaiting_decision") {
      return { ok: false, status: target.status };
    }
    target.status = decision;
    target.entries.push({
      decidedAt: "2026-11-02T07:15:00Z",
      decidedByName: names[currentUser.id] ?? currentUser.id,
      decision,
      comment,
    });
    return { ok: true, status: decision };
  });
  const repository: DecisionRepository = {
    listPage: async (_actor, view, page, pageSize) => {
      const wanted = records
        .filter((item) => (view === "awaiting" ? item.status === "awaiting_decision" : item.status !== "awaiting_decision"))
        .sort((a, b) => (view === "awaiting" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
      const start = (page - 1) * pageSize;
      return { records: wanted.slice(start, start + pageSize), page, hasNext: wanted.length > start + pageSize };
    },
    getRecord: async (_actor, recordId) => records.find((item) => item.id === recordId) ?? null,
    decide,
  };
  return { repository, decide };
}

describe("список «Awaiting decision» і «History»", () => {
  it("AC-DECIDE-01: менеджер основної посади бачить запис своєї посади й не бачить запису додаткової посади", async () => {
    const main = record({ id: "r-main" });
    const additional = record({ id: "r-additional", positionId: POSITION_ADDITIONAL, positionLabel: "High school / Math teacher" });
    const { repository } = fakeRepository([main, additional], MANAGER1);

    const list = await listAwaiting(repository, MANAGER1);

    expect(list.records.map((item) => item.id)).toEqual(["r-main"]);
  });

  it("AC-DECIDE-11: після схвалення одного з трьох записів у «Awaiting decision» лишається два, а схвалений потрапляє в «History»", async () => {
    const records = [
      record({ id: "r1", date: "2026-11-02" }),
      record({ id: "r2", date: "2026-11-03" }),
      record({ id: "r3", date: "2026-11-04" }),
    ];
    const { repository } = fakeRepository(records, MANAGER1);

    expect((await listAwaiting(repository, MANAGER1)).records.map((item) => item.id)).toEqual(["r1", "r2", "r3"]);
    await decideRecord(repository, "r2", "approved");

    expect((await listAwaiting(repository, MANAGER1)).records.map((item) => item.id)).toEqual(["r1", "r3"]);
    expect((await listHistory(repository, MANAGER1)).records.map((item) => item.id)).toEqual(["r2"]);
  });

  it("AC-DECIDE-14: без записів, що чекають рішення, менеджер бачить «No records awaiting decision»", async () => {
    const { repository } = fakeRepository([], MANAGER1);

    const list = await listAwaiting(repository, MANAGER1);

    expect(awaitingEmptyMessage(list.records)).toBe("No records awaiting decision");
    expect(awaitingEmptyMessage([record({ id: "r1" })])).toBeNull();
  });
});

describe("сторінки списків", () => {
  const many = (count: number, status: DecisionRecord["status"]) =>
    Array.from({ length: count }, (_, i) =>
      record({ id: `r${i}`, status, date: `2026-12-${String(i + 1).padStart(2, "0")}` }),
    );

  it("AC-DECIDE-01 (сторінки): «Awaiting decision» ділиться на сторінки: перша повна з ознакою наступної, друга — решта", async () => {
    const { repository } = fakeRepository(many(PAGE_SIZE + 5, "awaiting_decision"), MANAGER1);

    const first = await listAwaiting(repository, MANAGER1, 1);
    const second = await listAwaiting(repository, MANAGER1, 2);

    expect(first.records).toHaveLength(PAGE_SIZE);
    expect(first.hasNext).toBe(true);
    expect(second.records).toHaveLength(5);
    expect(second.hasNext).toBe(false);
  });

  it("AC-DECIDE-11 (сторінки): «History» на першій сторінці показує найновіші записи, а не найстаріші", async () => {
    const { repository } = fakeRepository(many(PAGE_SIZE + 5, "approved"), MANAGER1);

    const first = await listHistory(repository, MANAGER1, 1);

    expect(first.records[0].date).toBe(`2026-12-${PAGE_SIZE + 5}`);
    expect(first.hasNext).toBe(true);
  });

  it("номер сторінки й id запису з адреси перевіряються до запиту в базу", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "5"])).toBe(2);
    for (const bad of [undefined, "", "0", "-1", "1.5", "abc"]) {
      expect(parsePage(bad)).toBe(1);
    }
    expect(isRecordId("3f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f")).toBe(true);
    expect(isRecordId("abc")).toBe(false);
    expect(isRecordId("3f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f; drop table")).toBe(false);
  });
});

describe("рішення менеджера", () => {
  it("AC-DECIDE-02: схвалення одного із двох записів змінює лише його статус", async () => {
    const records = [record({ id: "r1" }), record({ id: "r2", date: "2026-11-03" })];
    const { repository } = fakeRepository(records, MANAGER1);

    const outcome = await decideRecord(repository, "r1", "approved");

    expect(outcome).toEqual({ ok: true, status: "approved" });
    expect(records.map((item) => item.status)).toEqual(["approved", "awaiting_decision"]);
  });

  it("AC-DECIDE-03: відхилення без коментаря дає статус «Rejected»", async () => {
    const records = [record({ id: "r1" })];
    const { repository, decide } = fakeRepository(records, MANAGER1);

    const outcome = await decideRecord(repository, "r1", "rejected");

    expect(outcome).toEqual({ ok: true, status: "rejected" });
    expect(decide).toHaveBeenCalledWith("r1", "rejected", null);
    expect(records[0].status).toBe("rejected");
  });

  it("AC-DECIDE-04: повернення без коментаря не змінює статус і показує «Tell the employee what to fix»", async () => {
    const records = [record({ id: "r1" })];
    const { repository, decide } = fakeRepository(records, MANAGER1);

    const noComment = await decideRecord(repository, "r1", "returned_for_revision");
    const blank = await decideRecord(repository, "r1", "returned_for_revision", "   ");

    expect(noComment).toEqual({ ok: false, code: "COMMENT_REQUIRED", message: "Tell the employee what to fix" });
    expect(blank).toEqual(noComment);
    expect(decide).not.toHaveBeenCalled();
    expect(records[0].status).toBe("awaiting_decision");
  });

  it("AC-DECIDE-05: повернення з коментарем зберігає коментар у рішенні й дає статус «Returned for revision»", async () => {
    const records = [record({ id: "r1" })];
    const { repository } = fakeRepository(records, MANAGER1);

    const outcome = await decideRecord(repository, "r1", "returned_for_revision", "Enter hours instead of a whole day");

    expect(outcome).toEqual({ ok: true, status: "returned_for_revision" });
    expect(records[0].entries[0].comment).toBe("Enter hours instead of a whole day");
  });

  it("AC-DECIDE-07: другий менеджер після схвалення першого бачить «Another manager has already decided: Approved», а запис лишається схваленим", async () => {
    const records = [record({ id: "r1" })];
    const second: Actor = { id: "manager3", role: "manager", managedPositionIds: [POSITION_MAIN] };
    const first = fakeRepository(records, MANAGER1);
    const late = fakeRepository(records, second);

    await decideRecord(first.repository, "r1", "approved");
    const outcome = await decideRecord(late.repository, "r1", "rejected");

    expect(outcome).toEqual({
      ok: false,
      code: "ALREADY_DECIDED",
      message: "Another manager has already decided: Approved",
    });
    expect(records[0].status).toBe("approved");
    expect(records[0].entries).toHaveLength(1);
  });

  it("AC-DECIDE-07: для запису, який скасував працівник, повідомлення про іншого менеджера не показуємо", async () => {
    const records = [record({ id: "r1", status: "cancelled" })];
    const { repository } = fakeRepository(records, MANAGER1);

    const outcome = await decideRecord(repository, "r1", "approved");

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.message).not.toContain("Another manager");
    expect(records[0].status).toBe("cancelled");
  });

  it("AC-DECIDE-08: менеджер чужої посади не вирішує запис, статус не змінюється", async () => {
    const records = [record({ id: "r1" })];
    const { repository } = fakeRepository(records, MANAGER2);

    const outcome = await decideRecord(repository, "r1", "approved");

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.code).toBe("FORBIDDEN");
    expect(records[0].status).toBe("awaiting_decision");
    expect(records[0].entries).toHaveLength(0);
  });

  it("AC-DECIDE-09: працівник без ролі менеджера не вирішує власний запис, статус не змінюється", async () => {
    const employee: Actor = { id: "teacher1", role: "employee", managedPositionIds: [] };
    const records = [record({ id: "r1" })];
    const { repository } = fakeRepository(records, employee);

    const outcome = await decideRecord(repository, "r1", "approved");

    expect(outcome.ok === false && outcome.code).toBe("FORBIDDEN");
    expect(records[0].status).toBe("awaiting_decision");
  });

  it("AC-DECIDE-10: адміністратор схвалює запис чужої посади, а історія показує адміністратора", async () => {
    const records = [record({ id: "r1" })];
    const { repository } = fakeRepository(records, ADMIN, { admin: "Admin" });

    const outcome = await decideRecord(repository, "r1", "approved");

    expect(outcome).toEqual({ ok: true, status: "approved" });
    expect(formatDecisionLine(records[0].entries[0])).toBe("2026-11-02 09:15 · Admin · Approved");
  });

  it("AC-DECIDE-18: менеджер не схвалює власний запис і бачить «Your own record is decided by an administrator»", async () => {
    const records = [record({ id: "r1", employeeId: "manager1", employeeName: "Manager One" })];
    const { repository } = fakeRepository(records, MANAGER1);

    const outcome = await decideRecord(repository, "r1", "approved");

    expect(outcome).toEqual({ ok: false, code: "OWN_RECORD", message: "Your own record is decided by an administrator" });
    expect(records[0].status).toBe("awaiting_decision");
  });

  it("AC-DECIDE-19: власний запис менеджера схвалює адміністратор", async () => {
    const records = [record({ id: "r1", employeeId: "manager1", employeeName: "Manager One" })];
    const { repository } = fakeRepository(records, ADMIN);

    const outcome = await decideRecord(repository, "r1", "approved");

    expect(outcome).toEqual({ ok: true, status: "approved" });
  });

  it("AC-DECIDE-23 (рішення): відхилення з коментарем «Not enough staff that day» зберігає коментар у рішенні", async () => {
    const records = [record({ id: "r1" })];
    const { repository } = fakeRepository(records, MANAGER1);

    const outcome = await decideRecord(repository, "r1", "rejected", "Not enough staff that day");

    expect(outcome).toEqual({ ok: true, status: "rejected" });
    expect(records[0].entries[0].comment).toBe("Not enough staff that day");
  });

  it("AC-DECIDE-24 (рішення): схвалення з коментарем «Get well soon» зберігає коментар у рішенні", async () => {
    const records = [record({ id: "r1" })];
    const { repository } = fakeRepository(records, MANAGER1);

    const outcome = await decideRecord(repository, "r1", "approved", "Get well soon");

    expect(outcome).toEqual({ ok: true, status: "approved" });
    expect(records[0].entries[0].comment).toBe("Get well soon");
  });
});

describe("запис і його історія", () => {
  it("AC-DECIDE-20: менеджер, відкривши запис, бачить коментар працівника «Doctor's appointment»", async () => {
    const { repository } = fakeRepository([record({ id: "r1", requestComment: "Doctor's appointment" })], MANAGER1);

    const opened = await getRecord(repository, MANAGER1, "r1");

    expect(opened?.requestComment).toBe("Doctor's appointment");
  });

  it("AC-DECIDE-15: рядок історії містить дату й час рішення за Києвом, хто вирішив і рішення", () => {
    const winter = formatDecisionLine({
      decidedAt: "2026-11-02T07:15:00Z",
      decidedByName: "Ihor Manager",
      decision: "approved",
      comment: null,
    });
    const summer = formatDecisionLine({
      decidedAt: "2026-07-02T07:15:00Z",
      decidedByName: "Ihor Manager",
      decision: "returned_for_revision",
      comment: "Enter hours",
    });

    expect(winter).toBe("2026-11-02 09:15 · Ihor Manager · Approved");
    expect(summer).toBe("2026-07-02 10:15 · Ihor Manager · Returned for revision");
  });
});
