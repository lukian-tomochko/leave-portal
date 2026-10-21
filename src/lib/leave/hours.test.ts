import { describe, expect, it } from "vitest";
import { planRequest } from "./request";
import { formatDuration } from "./time";
import type { Position, RequestInput } from "./types";

// Дати з прикладів PM: 2026-11-02 — понеділок, 2026-11-03 — вівторок, 2026-11-07 — субота.
const position = (id: string, blocks: Position["blocks"]): Position => ({
  id,
  kind: "main",
  division: "Elementary school",
  jobTitle: "Teacher",
  blocks,
});

const weekdays = (startsAt: string, endsAt: string) =>
  [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt, endsAt }));

// Розклад Mon–Fri 08:30–15:30.
const FULL_WEEK = position("p-full", weekdays("08:30", "15:30"));
// Блок 08:30–13:00 у понеділок (AC-LEAVE-07, AC-LEAVE-08).
const SHORT_MONDAY = position("p-short", [{ weekday: 1, startsAt: "08:30", endsAt: "13:00" }]);
// Вівторок із проміжком: 08:30–12:00 і 12:30–15:30 (AC-LEAVE-15, AC-LEAVE-19, AC-LEAVE-20).
const TUESDAY_GAP = position("p-gap", [
  { weekday: 2, startsAt: "08:30", endsAt: "12:00" },
  { weekday: 2, startsAt: "12:30", endsAt: "15:30" },
]);
// Розклад без суботи (AC-LEAVE-06).
const NO_SATURDAY = FULL_WEEK;

const request = (p: Position, date: string, startsAt: string, endsAt: string): RequestInput => ({
  leaveType: "personal",
  dates: [date],
  positionIds: [p.id],
  hours: { startsAt, endsAt },
});

describe("години в межах розкладу", () => {
  it("AC-LEAVE-04: години 09:00–11:30 дають 1 запис тривалістю 2 h 30 min", () => {
    const result = planRequest(request(FULL_WEEK, "2026-11-02", "09:00", "11:30"), { positions: [FULL_WEEK] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toMatchObject({ date: "2026-11-02", startsAt: "09:00", endsAt: "11:30", minutes: 150 });
      expect(formatDuration(result.records[0].minutes)).toBe("2 h 30 min");
    }
  });

  it("AC-LEAVE-06: дата без робочих годин (субота) не приймається з повідомленням PM", () => {
    const whole = planRequest({ leaveType: "sick", dates: ["2026-11-07"], positionIds: [NO_SATURDAY.id] }, { positions: [NO_SATURDAY] });
    const hours = planRequest(request(NO_SATURDAY, "2026-11-07", "09:00", "11:00"), { positions: [NO_SATURDAY] });

    for (const result of [whole, hours]) {
      expect(result).toEqual({ ok: false, code: "NO_WORKING_HOURS", message: "You have no working hours on this day" });
    }
  });

  it("AC-LEAVE-07: години раніше за блок відхиляються, повідомлення називає блок розкладу", () => {
    const result = planRequest(request(SHORT_MONDAY, "2026-11-02", "08:00", "10:00"), { positions: [SHORT_MONDAY] });

    expect(result).toEqual({
      ok: false,
      code: "HOURS_OUTSIDE_SCHEDULE",
      message: "Hours must be within your schedule: 08:30–13:00",
    });
  });

  it("AC-LEAVE-08: початок на кінці блоку (13:00) відхиляється, його можна обрати лише як кінець", () => {
    const result = planRequest(request(SHORT_MONDAY, "2026-11-02", "13:00", "14:00"), { positions: [SHORT_MONDAY] });

    expect(result).toEqual({
      ok: false,
      code: "START_AT_BLOCK_END",
      message: "13:00 is the end of working time and can only be chosen as the end of leave",
    });
  });

  it("AC-LEAVE-09: кінець раніший за початок відхиляється", () => {
    const result = planRequest(request(FULL_WEEK, "2026-11-02", "11:00", "10:00"), { positions: [FULL_WEEK] });

    expect(result).toEqual({ ok: false, code: "END_NOT_AFTER_START", message: "The end must be later than the start" });
  });

  it("AC-LEAVE-15: заявка через проміжок між блоками рахує лише хвилини в блоках (1 h 30 min)", () => {
    const result = planRequest(request(TUESDAY_GAP, "2026-11-03", "11:00", "13:00"), { positions: [TUESDAY_GAP] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toMatchObject({ date: "2026-11-03", startsAt: "11:00", endsAt: "13:00", minutes: 90 });
      expect(formatDuration(result.records[0].minutes)).toBe("1 h 30 min");
    }
  });

  it("AC-LEAVE-19: повідомлення про години поза розкладом перелічує всі блоки дня", () => {
    const result = planRequest(request(TUESDAY_GAP, "2026-11-03", "07:30", "09:00"), { positions: [TUESDAY_GAP] });

    expect(result).toEqual({
      ok: false,
      code: "HOURS_OUTSIDE_SCHEDULE",
      message: "Hours must be within your schedule: 08:30–12:00, 12:30–15:30",
    });
  });

  it("AC-LEAVE-20: початок на кінці першого блоку (12:00) дає повідомлення про кінець робочого часу", () => {
    const result = planRequest(request(TUESDAY_GAP, "2026-11-03", "12:00", "13:00"), { positions: [TUESDAY_GAP] });

    expect(result).toEqual({
      ok: false,
      code: "START_AT_BLOCK_END",
      message: "12:00 is the end of working time and can only be chosen as the end of leave",
    });
  });
});

describe("години: межі, яких немає в AC", () => {
  it("початок у проміжку між блоками (12:15) — це «поза розкладом», а не кінець блоку", () => {
    const result = planRequest(request(TUESDAY_GAP, "2026-11-03", "12:15", "14:00"), { positions: [TUESDAY_GAP] });

    expect(result).toMatchObject({ ok: false, code: "HOURS_OUTSIDE_SCHEDULE" });
  });

  it("кінець, що збігається з кінцем блоку, допустимий", () => {
    const result = planRequest(request(SHORT_MONDAY, "2026-11-02", "12:00", "13:00"), { positions: [SHORT_MONDAY] });

    expect(result.ok).toBe(true);
  });

  it("час не кратний 5 хвилинам не доходить до запису (текст для нього PM не давав)", () => {
    const result = planRequest(request(FULL_WEEK, "2026-11-02", "09:02", "11:30"), { positions: [FULL_WEEK] });

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("некоректний формат часу — це недійсний вхід, а не виняток", () => {
    const result = planRequest(request(FULL_WEEK, "2026-11-02", "9:00", "11:30"), { positions: [FULL_WEEK] });

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});
