import { describe, expect, it } from "vitest";
import { buildDayMap, defaultMonth, monthCells, monthLabel, parseMonth, resolveCalendar, schoolYearOfMonth, shiftMonth } from "./calendar-view";

describe("місяць у адресі календаря", () => {
  it("приймає YYYY-MM у межах 2000–2100, решту замінює запасним", () => {
    expect(parseMonth("2026-11", "2026-09")).toBe("2026-11");
    expect(parseMonth("2026-13", "2026-09")).toBe("2026-09");
    expect(parseMonth("1999-05", "2026-09")).toBe("2026-09");
    expect(parseMonth(undefined, "2026-09")).toBe("2026-09");
    expect(parseMonth(["2027-02", "2027-03"], "2026-09")).toBe("2027-02");
  });

  it("зсуває місяць через межу року в обидва боки", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-11", 14)).toBe("2028-01");
  });

  it("підписує місяць українською й визначає навчальний рік", () => {
    expect(monthLabel("2026-11")).toBe("Листопад 2026");
    expect(schoolYearOfMonth("2026-08")).toBe(2025);
    expect(schoolYearOfMonth("2026-09")).toBe(2026);
    expect(schoolYearOfMonth("2027-01")).toBe(2026);
  });

  it("за замовчуванням бере місяць сьогодні, якщо він у році, інакше вересень", () => {
    expect(defaultMonth("2026-11-13", 2026)).toBe("2026-11");
    expect(defaultMonth("2026-11-13", 2027)).toBe("2027-09");
  });
});

describe("параметри календаря", () => {
  it("місяць має пріоритет над роком; рік списку — навчальний рік цього місяця", () => {
    expect(resolveCalendar({ month: "2027-02", year: "2030" }, "2026-11-13")).toEqual({ year: 2026, month: "2027-02", view: "month" });
  });

  it("без місяця бере ?year=: поточний місяць, якщо він у цьому році, інакше вересень", () => {
    expect(resolveCalendar({ year: "2026" }, "2026-11-13")).toEqual({ year: 2026, month: "2026-11", view: "month" });
    expect(resolveCalendar({ year: "2027", view: "year" }, "2026-11-13")).toEqual({ year: 2027, month: "2027-09", view: "year" });
  });

  it("без параметрів показує поточний місяць поточного навчального року; сміття в параметрах ігнорує", () => {
    expect(resolveCalendar({}, "2026-11-13")).toEqual({ year: 2026, month: "2026-11", view: "month" });
    expect(resolveCalendar({ month: "abc", year: "x", view: "zzz" }, "2027-02-01")).toEqual({ year: 2026, month: "2027-02", view: "month" });
  });
});

describe("клітинки місяця", () => {
  it("листопад 2026 починається з неділі: шість порожніх клітинок перед 1-м, вихідні позначено", () => {
    const cells = monthCells("2026-11");
    expect(cells.slice(0, 6).every((cell) => cell === null)).toBe(true);
    expect(cells[6]).toEqual({ date: "2026-11-01", day: 1, weekend: true });
    expect(cells.filter(Boolean)).toHaveLength(30);
    expect(cells.find((cell) => cell?.date === "2026-11-13")?.weekend).toBe(false);
  });

  it("лютий високосного року має 29 днів", () => {
    expect(monthCells("2028-02").filter(Boolean)).toHaveLength(29);
  });
});

describe("дані днів", () => {
  it("кладе закриття, власні записи й відсутніх лише на дні вказаного місяця", () => {
    const map = buildDayMap({
      month: "2026-11",
      closures: [{ name: "Early", startsOn: "2026-11-20", endsOn: "2026-11-20", closedFrom: "12:00" }],
      mine: [
        { date: "2026-11-18", leaveType: "personal", status: "awaiting_decision" },
        { date: "2026-12-01", leaveType: "sick", status: "approved" },
      ],
      team: [
        { name: "A", date: "2026-11-18", status: "approved" },
        { name: "A", date: "2026-11-18", status: "approved" },
        { name: "B", date: "2026-11-18", status: "awaiting_decision" },
      ],
    });
    expect(map["2026-11-20"]?.closure).toEqual({ name: "Early", early: true, text: "2026-11-20 з 12:00" });
    expect(map["2026-11-18"]?.mine).toEqual([{ leaveType: "personal", status: "awaiting_decision" }]);
    expect(map["2026-11-18"]?.away?.map((entry) => entry.name)).toEqual(["A", "B"]);
    expect(map["2026-12-01"]).toBeUndefined();
  });
});
