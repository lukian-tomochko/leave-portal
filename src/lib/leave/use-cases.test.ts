import { describe, expect, it } from "vitest";
import { LeaveConflictError, type LeaveRepository, type NewRequest } from "./repository";
import type { ExistingRecord, Position } from "./types";
import { previewRequest, submitRequest } from "./use-cases";

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
}) {
  const created: NewRequest[] = [];
  let existing = options.existing ?? [];
  const repository: LeaveRepository = {
    loadPositions: async () => [MAIN],
    loadExistingRecords: async () => existing,
    createRequest: async (request) => {
      if (options.conflictOnCreate) {
        existing = options.conflictOnCreate.existingAfter;
        throw new LeaveConflictError();
      }
      created.push(request);
      return `request-${created.length}`;
    },
    listRecords: async () => [],
  };
  return { repository, created };
}

const TWO_DATES = { leaveType: "sick" as const, dates: ["2026-11-02", "2026-11-03"], positionIds: ["main"] };

describe("сценарії над репозиторієм", () => {
  it("AC-LEAVE-05: дві дати створюються однією заявкою з двома записами", async () => {
    const { repository, created } = fakeRepository({});

    const outcome = await submitRequest(repository, "employee-1", TWO_DATES);

    expect(outcome).toEqual({ ok: true, requestId: "request-1" });
    expect(created).toHaveLength(1);
    expect(created[0].records.map((r) => r.date)).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("AC-LEAVE-11: підсумок нічого не створює, поки заявку не підтверджено", async () => {
    const { repository, created } = fakeRepository({});

    const outcome = await previewRequest(repository, "employee-1", TWO_DATES);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.records).toHaveLength(2);
    }
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
