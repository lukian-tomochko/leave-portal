import { describe, expect, it } from "vitest";
import { planRequest } from "./request";
import type { ExistingRecord, Position } from "./types";

// Дані з прикладів PM (requirements/01-leave-request.md). 2026-11-02 — понеділок, 2026-11-03 — вівторок.
const MAIN: Position = {
  id: "main",
  kind: "main",
  division: "Elementary school",
  jobTitle: "Teacher",
  blocks: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "08:30", endsAt: "15:30" })),
};
// Додаткова посада працює лише в понеділок 15:45–17:00 (AC-LEAVE-02).
const ADDITIONAL: Position = {
  id: "additional",
  kind: "additional",
  division: "High school",
  jobTitle: "Math teacher",
  blocks: [{ weekday: 1, startsAt: "15:45", endsAt: "17:00" }],
};
const POSITIONS = [MAIN, ADDITIONAL];

const existing = (over: Partial<ExistingRecord>): ExistingRecord => ({
  positionId: "main",
  date: "2026-11-02",
  startsAt: "09:00",
  endsAt: "11:00",
  status: "awaiting_decision",
  ...over,
});

describe("заявка на кілька посад і дат", () => {
  it("AC-LEAVE-02: цілий день на двох посадах створює 2 записи в одній заявці", () => {
    const result = planRequest({ leaveType: "sick", dates: ["2026-11-02"], positionIds: ["main", "additional"] }, { positions: POSITIONS });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records.map((r) => [r.positionId, r.startsAt, r.endsAt, r.status])).toEqual([
        ["main", "08:30", "15:30", "awaiting_decision"],
        ["additional", "15:45", "17:00", "awaiting_decision"],
      ]);
    }
  });

  it("AC-LEAVE-03: виключена додаткова посада не дає запису", () => {
    const result = planRequest({ leaveType: "sick", dates: ["2026-11-02"], positionIds: ["main"] }, { positions: POSITIONS });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(1);
      expect(result.records[0].positionId).toBe("main");
      expect(result.records.some((r) => r.positionId === "additional")).toBe(false);
    }
  });

  it("дві дати дають 2 записи (по одному на дату) в одному результаті планування", () => {
    const result = planRequest({ leaveType: "sick", dates: ["2026-11-02", "2026-11-03"], positionIds: ["main"] }, { positions: POSITIONS });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records.map((r) => r.date)).toEqual(["2026-11-02", "2026-11-03"]);
    }
  });

  it("AC-LEAVE-10: жодної посади — повідомлення PM і жодного запису", () => {
    const result = planRequest({ leaveType: "sick", dates: ["2026-11-02"], positionIds: [] }, { positions: POSITIONS });

    expect(result).toEqual({ ok: false, code: "NO_POSITION_CHOSEN", message: "Choose at least one position" });
  });

  it("посада без розкладу в цей день пропускається, якщо інша обрана посада працює (Main scenario, крок 2)", () => {
    // Вівторок: додаткова посада не працює, основна працює.
    const result = planRequest({ leaveType: "sick", dates: ["2026-11-03"], positionIds: ["main", "additional"] }, { positions: POSITIONS });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records.map((r) => r.positionId)).toEqual(["main"]);
    }
  });

  it("AC-LEAVE-21: субота без годин не приймається з повідомленням, а п'ятниця лишається в заявці", () => {
    // 2026-11-06 — п'ятниця, 2026-11-07 — субота; основна посада працює пн–пт 08:30–15:30.
    const result = planRequest(
      { leaveType: "sick", dates: ["2026-11-06", "2026-11-07"], positionIds: ["main"] },
      { positions: POSITIONS },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records.map((r) => r.date)).toEqual(["2026-11-06"]);
      expect(result.skippedDates).toEqual(["2026-11-07"]);
    }
  });

  it("усі обрані дати без годин — заявки немає й повідомлення «No working hours»", () => {
    const result = planRequest(
      { leaveType: "sick", dates: ["2026-11-07", "2026-11-08"], positionIds: ["main"] },
      { positions: POSITIONS },
    );

    expect(result).toEqual({ ok: false, code: "NO_WORKING_HOURS", message: "You have no working hours on this day" });
  });

  it("жодна з обраних посад не працює в цей день — «No working hours»", () => {
    const result = planRequest({ leaveType: "sick", dates: ["2026-11-03"], positionIds: ["additional"] }, { positions: POSITIONS });

    expect(result).toEqual({ ok: false, code: "NO_WORKING_HOURS", message: "You have no working hours on this day" });
  });
});

describe("перетин із наявними записами", () => {
  it("AC-LEAVE-13: перетин із записом тієї самої посади відхиляється з датою й годинами наявного запису", () => {
    const result = planRequest(
      { leaveType: "personal", dates: ["2026-11-02"], positionIds: ["main"], hours: { startsAt: "10:00", endsAt: "12:00" } },
      { positions: POSITIONS, existing: [existing({})] },
    );

    expect(result).toEqual({
      ok: false,
      code: "TIME_CONFLICT",
      message: "You already have a request for this time: 2026-11-02 09:00–11:00",
    });
  });

  it("конфлікт на одній даті скасовує всю заявку: планування не повертає записів на жодну з дат", () => {
    const result = planRequest(
      { leaveType: "sick", dates: ["2026-11-02", "2026-11-03"], positionIds: ["main"] },
      { positions: POSITIONS, existing: [existing({ date: "2026-11-03" })] },
    );

    expect(result).toEqual({
      ok: false,
      code: "TIME_CONFLICT",
      message: "You already have a request for this time: 2026-11-03 09:00–11:00",
    });
    expect("records" in result).toBe(false);
  });

  it("запис, що лише межує з наявним (11:00), не перетинається", () => {
    const result = planRequest(
      { leaveType: "personal", dates: ["2026-11-02"], positionIds: ["main"], hours: { startsAt: "11:00", endsAt: "12:00" } },
      { positions: POSITIONS, existing: [existing({})] },
    );

    expect(result.ok).toBe(true);
  });

  it("записи зі статусом «Rejected» чи «Cancelled» не блокують, а «Returned for revision» і «Approved» блокують", () => {
    const request = {
      leaveType: "personal" as const,
      dates: ["2026-11-02"],
      positionIds: ["main"],
      hours: { startsAt: "10:00", endsAt: "10:30" },
    };

    for (const status of ["rejected", "cancelled"] as const) {
      expect(planRequest(request, { positions: POSITIONS, existing: [existing({ status })] }).ok).toBe(true);
    }
    for (const status of ["returned_for_revision", "approved"] as const) {
      expect(planRequest(request, { positions: POSITIONS, existing: [existing({ status })] })).toMatchObject({
        ok: false,
        code: "TIME_CONFLICT",
      });
    }
  });

  it("перетин лише в межах тієї самої посади: той самий час на іншій посаді не конфліктує", () => {
    const result = planRequest(
      { leaveType: "sick", dates: ["2026-11-02"], positionIds: ["additional"] },
      { positions: POSITIONS, existing: [existing({ positionId: "main", startsAt: "15:45", endsAt: "17:00" })] },
    );

    expect(result.ok).toBe(true);
  });
});
