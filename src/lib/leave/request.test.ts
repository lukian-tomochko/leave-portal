import { describe, expect, it } from "vitest";
import { STATUS_LABELS } from "./messages";
import { planRequest } from "./request";
import type { Position } from "./types";

// Дані з прикладів PM (requirements/01-leave-request.md): основна посада "Elementary school / Teacher",
// розклад Mon–Fri 08:30–15:30. 2026-11-02 — понеділок.
const MAIN: Position = {
  id: "pos-main",
  kind: "main",
  division: "Elementary school",
  jobTitle: "Teacher",
  blocks: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "08:30", endsAt: "15:30" })),
};

describe("planRequest: цілий день", () => {
  it("AC-LEAVE-01: цілий день на одній посаді створює 1 запис зі статусом «Awaiting decision»", () => {
    const result = planRequest({ leaveType: "sick", dates: ["2026-11-02"], positionIds: ["pos-main"] }, { positions: [MAIN] });

    expect(result).toEqual({
      ok: true,
      leaveType: "sick",
      records: [
        {
          positionId: "pos-main",
          date: "2026-11-02",
          startsAt: "08:30",
          endsAt: "15:30",
          minutes: 420,
          status: "awaiting_decision",
        },
      ],
      skippedDates: [],
    });
    if (result.ok) {
      expect(STATUS_LABELS[result.records[0].status]).toBe("Awaiting decision");
    }
  });

  it("не створює жодного запису, коли посада не з контексту працівника", () => {
    const result = planRequest({ leaveType: "sick", dates: ["2026-11-02"], positionIds: ["someone-elses"] }, { positions: [MAIN] });

    expect(result).toEqual({ ok: false, code: "INVALID_INPUT", message: "Invalid request" });
  });

  it("відхиляє некоректну дату й невідомий тип відпустки", () => {
    const badDate = planRequest({ leaveType: "sick", dates: ["2026-02-30"], positionIds: ["pos-main"] }, { positions: [MAIN] });
    const badType = planRequest(
      { leaveType: "vacation" as never, dates: ["2026-11-02"], positionIds: ["pos-main"] },
      { positions: [MAIN] },
    );

    expect(badDate.ok).toBe(false);
    expect(badType.ok).toBe(false);
  });
});
