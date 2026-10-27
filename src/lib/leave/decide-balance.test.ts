import { describe, expect, it, vi } from "vitest";
import { type ApprovedRecord, type BalanceInputs, BalanceDeniedError } from "./balance";
import { decideWithBalance } from "./decide-balance";
import type { Actor, DecisionRecord, DecisionRepository } from "./decision";
import type { Position } from "./types";

const MAIN: Position = {
  id: "main",
  kind: "main",
  division: "Elementary school",
  jobTitle: "Teacher",
  blocks: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "08:30", endsAt: "15:30" })),
};
const MANAGER: Actor = { id: "manager1", role: "manager", managedPositionIds: ["main"] };

const target: DecisionRecord = {
  id: "r1",
  employeeId: "teacher1",
  employeeName: "Teacher One",
  positionId: "main",
  positionLabel: "Elementary school / Teacher",
  date: "2026-11-03",
  startsAt: "08:30",
  endsAt: "15:30",
  leaveType: "personal",
  status: "awaiting_decision",
  requestComment: null,
  entries: [],
};

// Залишок «Personal leave» 0.50: 17 цілих днів і півдня вже погоджено в цьому навчальному році (приклади PM).
function inputsWithRemaining(): BalanceInputs {
  const records: ApprovedRecord[] = [];
  const day = new Date("2026-09-01T00:00:00Z");
  while (records.length < 18) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) {
      const half = records.length === 17;
      records.push({
        id: `p${records.length}`,
        positionId: "main",
        date: day.toISOString().slice(0, 10),
        startsAt: "08:30",
        endsAt: half ? "12:00" : "15:30",
        leaveType: "personal",
        paidCents: null,
        unpaidCents: 0,
      });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return { positions: [MAIN], records };
}

function setup(record: DecisionRecord = target) {
  const decide = vi.fn(async () => ({ ok: true as const, status: "approved" as const }));
  const repository: DecisionRepository = {
    listPage: async () => ({ records: [], page: 1, hasNext: false }),
    getRecord: async () => record,
    decide,
  };
  return { repository, decide };
}

describe("схвалення з урахуванням балансу", () => {
  it("AC-BALANCE-16: схвалення «Personal leave» понад залишок без розподілу відхилено, база не викликається", async () => {
    const { repository, decide } = setup();

    const outcome = await decideWithBalance(repository, async () => inputsWithRemaining(), MANAGER, "r1", "approved", undefined, false);

    expect(outcome).toEqual({
      ok: false,
      code: "SPLIT_REQUIRED",
      message: "The Personal leave balance is 0.50 day: approve with the suggested split or reject",
    });
    expect(decide).not.toHaveBeenCalled();
  });

  it("AC-BALANCE-10: схвалення із запропонованим розподілом передає 0.50 оплачуваних і 0.50 неоплачуваних", async () => {
    const { repository, decide } = setup();

    const outcome = await decideWithBalance(repository, async () => inputsWithRemaining(), MANAGER, "r1", "approved", undefined, true);

    expect(outcome).toEqual({ ok: true, status: "approved" });
    expect(decide).toHaveBeenCalledWith("r1", "approved", null, { paidCents: 50, unpaidCents: 50 });
  });

  it("AC-BALANCE-10: у межах залишку схвалення йде без розподілу", async () => {
    const { repository, decide } = setup({ ...target, startsAt: "08:30", endsAt: "12:00" });

    await decideWithBalance(repository, async () => inputsWithRemaining(), MANAGER, "r1", "approved", undefined, false);

    expect(decide).toHaveBeenCalledWith("r1", "approved", null, undefined);
  });

  it("AC-BALANCE-12: відмова бази у вхідних даних балансу дає FORBIDDEN без рішення", async () => {
    const { repository, decide } = setup();
    const denied = async (): Promise<BalanceInputs> => {
      throw new BalanceDeniedError();
    };

    const outcome = await decideWithBalance(repository, denied, MANAGER, "r1", "approved", undefined, true);

    expect(outcome).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(decide).not.toHaveBeenCalled();
  });

  it("AC-BALANCE-07: відхилення не залежить від балансу й не читає його", async () => {
    const { repository, decide } = setup();
    const loadInputs = vi.fn(async () => inputsWithRemaining());

    await decideWithBalance(repository, loadInputs, MANAGER, "r1", "rejected", undefined, false);

    expect(loadInputs).not.toHaveBeenCalled();
    expect(decide).toHaveBeenCalledOnce();
  });
});
