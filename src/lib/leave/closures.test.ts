import { describe, expect, it } from "vitest";
import { closuresInSchoolYear, closureOn, describeClosure, openBlocks, parseSchoolYear, type Closure } from "./closures";
import { noClosuresInYear } from "./messages";
import { planRequest } from "./request";
import type { Position, RequestInput, ScheduleBlock } from "./types";
import { expectOk } from "../../../tests/support/expect-ok";

// Дати: 2026-11-20 — п'ятниця, 2026-12-29 — вівторок, 2027-01-02 — субота, 2027-01-12 — вівторок.
const weekdays = (startsAt: string, endsAt: string): ScheduleBlock[] =>
  [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt, endsAt }));

// Розклад Mon–Fri 08:30–15:30.
const FULL_WEEK: Position = {
  id: "p-full",
  kind: "main",
  division: "Elementary school",
  jobTitle: "Teacher",
  blocks: weekdays("08:30", "15:30"),
};

const WINTER_BREAK: Closure = { name: "Winter break", startsOn: "2026-12-28", endsOn: "2027-01-08", closedFrom: null };
const TEACHERS_MEETING: Closure = {
  name: "Teachers' meeting",
  startsOn: "2026-11-20",
  endsOn: "2026-11-20",
  closedFrom: "12:00",
};

const FRIDAY_FULL: ScheduleBlock[] = [{ weekday: 5, startsAt: "08:30", endsAt: "15:30" }];
const FRIDAY_GAP: ScheduleBlock[] = [
  { weekday: 5, startsAt: "08:30", endsAt: "12:00" },
  { weekday: 5, startsAt: "12:30", endsAt: "15:30" },
];

const wholeDayRequest = (...dates: string[]): RequestInput => ({
  leaveType: "personal",
  dates,
  positionIds: [FULL_WEEK.id],
});

const hoursRequest = (date: string, startsAt: string, endsAt: string): RequestInput => ({
  leaveType: "personal",
  dates: [date],
  positionIds: [FULL_WEEK.id],
  hours: { startsAt, endsAt },
});

describe("closureOn", () => {
  it("AC-CAL-03: дата всередині «Winter break» (включно з першим і останнім днем) повертає закриття", () => {
    const closures = [WINTER_BREAK];

    expect(closureOn(closures, "2026-12-28")).toEqual(WINTER_BREAK);
    expect(closureOn(closures, "2026-12-29")).toEqual(WINTER_BREAK);
    expect(closureOn(closures, "2027-01-08")).toEqual(WINTER_BREAK);
  });

  it("AC-CAL-03: дата перед початком і після кінця закриття не закрита", () => {
    const closures = [WINTER_BREAK];

    expect(closureOn(closures, "2026-12-27")).toBeUndefined();
    expect(closureOn(closures, "2027-01-09")).toBeUndefined();
    expect(closureOn([], "2026-12-29")).toBeUndefined();
  });

  it("AC-CAL-04: дострокове закриття діє лише на свою дату", () => {
    const closures = [TEACHERS_MEETING];

    expect(closureOn(closures, "2026-11-20")).toEqual(TEACHERS_MEETING);
    expect(closureOn(closures, "2026-11-19")).toBeUndefined();
    expect(closureOn(closures, "2026-11-21")).toBeUndefined();
  });

  it("AC-CAL-03: серед кількох закриттів знаходить те, що містить дату", () => {
    const closures = [TEACHERS_MEETING, WINTER_BREAK];

    expect(closureOn(closures, "2026-12-29")).toEqual(WINTER_BREAK);
    expect(closureOn(closures, "2026-11-20")).toEqual(TEACHERS_MEETING);
  });
});

describe("openBlocks", () => {
  it("AC-CAL-09: без закриття блоки не змінюються", () => {
    expect(openBlocks(FRIDAY_FULL, undefined)).toEqual(FRIDAY_FULL);
  });

  it("AC-CAL-03: закриття на цілі дні не лишає відкритих блоків", () => {
    expect(openBlocks(FRIDAY_FULL, WINTER_BREAK)).toEqual([]);
    expect(openBlocks(FRIDAY_GAP, WINTER_BREAK)).toEqual([]);
  });

  it("AC-CAL-04: дострокове закриття з 12:00 обрізає блок 08:30–15:30 до 08:30–12:00", () => {
    expect(openBlocks(FRIDAY_FULL, TEACHERS_MEETING)).toEqual([{ weekday: 5, startsAt: "08:30", endsAt: "12:00" }]);
  });

  it("AC-CAL-04: блок, що закінчується до часу закриття, лишається без змін, а блок, що починається після, зникає", () => {
    // Блоки 08:30–12:00 і 12:30–15:30, закриття з 12:00: перший цілий, другий починається після 12:00.
    expect(openBlocks(FRIDAY_GAP, TEACHERS_MEETING)).toEqual([{ weekday: 5, startsAt: "08:30", endsAt: "12:00" }]);
  });

  it("AC-CAL-04: закриття посеред другого блоку обрізає його, перший блок лишається цілим", () => {
    const closure: Closure = { ...TEACHERS_MEETING, closedFrom: "14:00" };

    expect(openBlocks(FRIDAY_GAP, closure)).toEqual([
      { weekday: 5, startsAt: "08:30", endsAt: "12:00" },
      { weekday: 5, startsAt: "12:30", endsAt: "14:00" },
    ]);
  });

  it("AC-CAL-04: час закриття на початку блоку (08:30) не лишає відкритих годин", () => {
    const closure: Closure = { ...TEACHERS_MEETING, closedFrom: "08:30" };

    expect(openBlocks(FRIDAY_FULL, closure)).toEqual([]);
  });

  it("AC-CAL-04: час закриття на кінці блоку (15:30) лишає блок без змін", () => {
    const closure: Closure = { ...TEACHERS_MEETING, closedFrom: "15:30" };

    expect(openBlocks(FRIDAY_FULL, closure)).toEqual(FRIDAY_FULL);
  });
});

describe("planRequest із закриттями школи", () => {
  it("AC-CAL-03: вівторок 2026-12-29 у «Winter break» не приймається з повідомленням PM", () => {
    const context = { positions: [FULL_WEEK], closures: [WINTER_BREAK] };

    const result = planRequest(wholeDayRequest("2026-12-29"), context);

    expect(result).toEqual({
      ok: false,
      code: "SCHOOL_CLOSED",
      message: "The school is closed on this day: Winter break",
    });
  });

  it("AC-CAL-03: закрита дата з годинами теж не приймається з повідомленням PM", () => {
    const context = { positions: [FULL_WEEK], closures: [WINTER_BREAK] };

    const result = planRequest(hoursRequest("2026-12-29", "09:00", "11:00"), context);

    expect(result).toEqual({
      ok: false,
      code: "SCHOOL_CLOSED",
      message: "The school is closed on this day: Winter break",
    });
  });

  it("AC-CAL-03: у заявці на дві дати закриту відкинуто з назвою, друга дата лишається", () => {
    const context = { positions: [FULL_WEEK], closures: [WINTER_BREAK] };

    const result = planRequest(wholeDayRequest("2026-12-29", "2027-01-12"), context);

    const resultOk = expectOk(result);
    expect(resultOk.records).toHaveLength(1);
    expect(resultOk.records[0]).toMatchObject({ date: "2027-01-12", startsAt: "08:30", endsAt: "15:30", minutes: 420 });
    expect(resultOk).toMatchObject({ skippedClosed: [{ date: "2026-12-29", name: "Winter break" }] });
  });

  it("AC-CAL-03: субота всередині закриття лишає стару відмову «No working hours»", () => {
    const context = { positions: [FULL_WEEK], closures: [WINTER_BREAK] };

    const result = planRequest(wholeDayRequest("2027-01-02"), context);

    expect(result).toEqual({ ok: false, code: "NO_WORKING_HOURS", message: "You have no working hours on this day" });
  });

  it("AC-CAL-04: цілий день 2026-11-20 при достроковому закритті з 12:00 дає 1 запис 08:30–12:00 (210 хв)", () => {
    const context = { positions: [FULL_WEEK], closures: [TEACHERS_MEETING] };

    const result = planRequest(wholeDayRequest("2026-11-20"), context);

    const resultOk = expectOk(result);
    expect(resultOk.records).toHaveLength(1);
    expect(resultOk.records[0]).toMatchObject({
      positionId: "p-full",
      date: "2026-11-20",
      startsAt: "08:30",
      endsAt: "12:00",
      minutes: 210,
      status: "awaiting_decision",
    });
  });

  it("AC-CAL-05: години 13:00–14:00 при достроковому закритті з 12:00 відхиляються з повідомленням PM", () => {
    const context = { positions: [FULL_WEEK], closures: [TEACHERS_MEETING] };

    const result = planRequest(hoursRequest("2026-11-20", "13:00", "14:00"), context);

    expect(result).toEqual({
      ok: false,
      code: "HOURS_OUTSIDE_SCHEDULE",
      message: "Hours must be within your schedule: 08:30–12:00",
    });
  });

  it("AC-CAL-05: години 11:00–13:00, що виходять за час закриття, теж відхиляються", () => {
    const context = { positions: [FULL_WEEK], closures: [TEACHERS_MEETING] };

    const result = planRequest(hoursRequest("2026-11-20", "11:00", "13:00"), context);

    expect(result).toEqual({
      ok: false,
      code: "HOURS_OUTSIDE_SCHEDULE",
      message: "Hours must be within your schedule: 08:30–12:00",
    });
  });

  it("AC-CAL-04: години 09:00–12:00 до часу закриття приймаються (кінець — на часі закриття)", () => {
    const context = { positions: [FULL_WEEK], closures: [TEACHERS_MEETING] };

    const result = planRequest(hoursRequest("2026-11-20", "09:00", "12:00"), context);

    const resultOk = expectOk(result);
    expect(resultOk.records[0]).toMatchObject({ date: "2026-11-20", startsAt: "09:00", endsAt: "12:00", minutes: 180 });
  });

  it("AC-CAL-09: після видалення закриття (closures: []) 2026-12-29 приймається з годинами 08:30–15:30", () => {
    const context = { positions: [FULL_WEEK], closures: [] as Closure[] };

    const result = planRequest(wholeDayRequest("2026-12-29"), context);

    const resultOk = expectOk(result);
    expect(resultOk.records).toHaveLength(1);
    expect(resultOk.records[0]).toMatchObject({ date: "2026-12-29", startsAt: "08:30", endsAt: "15:30", minutes: 420 });
  });
});

describe("шкільний календар за навчальний рік", () => {
  const summer: Closure = { name: "Summer break", startsOn: "2027-08-25", endsOn: "2027-09-03", closedFrom: null };

  it("AC-CAL-02: «Winter break» 2026-12-28 – 2027-01-08 потрапляє в навчальний рік 2026–2027, а закриття за датою йдуть упорядковано", () => {
    const rows = closuresInSchoolYear([WINTER_BREAK, TEACHERS_MEETING], 2026);

    expect(rows.map((row) => row.name)).toEqual(["Teachers' meeting", "Winter break"]);
    expect(describeClosure(WINTER_BREAK)).toBe("2026-12-28 – 2027-01-08");
    expect(describeClosure(TEACHERS_MEETING)).toBe("2026-11-20 з 12:00");
  });

  it("AC-CAL-02: закриття через 31.08 показується в обох навчальних роках, а закриття поза роком — ні", () => {
    expect(closuresInSchoolYear([summer], 2026)).toEqual([summer]);
    expect(closuresInSchoolYear([summer], 2027)).toEqual([summer]);
    expect(closuresInSchoolYear([summer], 2025)).toEqual([]);
    expect(closuresInSchoolYear([summer], 2028)).toEqual([]);
    // Межі року: 2026-08-31 ще 2025–2026, 2026-09-01 уже 2026–2027.
    const edge: Closure = { name: "Edge", startsOn: "2026-08-31", endsOn: "2026-08-31", closedFrom: null };
    expect(closuresInSchoolYear([edge], 2025)).toEqual([edge]);
    expect(closuresInSchoolYear([edge], 2026)).toEqual([]);
    const firstDay: Closure = { name: "First day", startsOn: "2026-09-01", endsOn: "2026-09-01", closedFrom: null };
    expect(closuresInSchoolYear([firstDay], 2026)).toEqual([firstDay]);
    expect(closuresInSchoolYear([firstDay], 2025)).toEqual([]);
  });

  it("AC-CAL-15: у навчальному році без закриттів повідомлення «No closed days in school year 2026–2027»", () => {
    expect(closuresInSchoolYear([], 2026)).toEqual([]);
    expect(noClosuresInYear(2026)).toBe("No closed days in school year 2026–2027");
  });

  it("AC-CAL-02: параметр року приймає чотири цифри 2000–2100, а некоректне значення дає поточний навчальний рік", () => {
    expect(parseSchoolYear("2027", 2026)).toBe(2027);
    expect(parseSchoolYear(["2025", "2027"], 2026)).toBe(2025);
    expect(parseSchoolYear(undefined, 2026)).toBe(2026);
    expect(parseSchoolYear("abc", 2026)).toBe(2026);
    expect(parseSchoolYear("1999", 2026)).toBe(2026);
    expect(parseSchoolYear("20277", 2026)).toBe(2026);
  });
});
