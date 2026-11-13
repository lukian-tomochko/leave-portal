import { describe, expect, it } from "vitest";
import {
  addDays,
  buildTeamOverview,
  daysBetween,
  groupAbsences,
  monthlyCounts,
  nextAbsence,
  schoolMonthIndex,
  statusCounts,
  type DatedRecord,
} from "./dashboard";

const rec = (date: string, status: DatedRecord["status"] = "approved", leaveType: DatedRecord["leaveType"] = "personal"): DatedRecord => ({
  date,
  status,
  leaveType,
});

describe("дати для дашборду", () => {
  it("рахує дні між датами й додає дні через межу місяця", () => {
    expect(daysBetween("2026-11-13", "2026-11-18")).toBe(5);
    expect(daysBetween("2026-11-18", "2026-11-13")).toBe(-5);
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
  });

  it("вересень — перший місяць навчального року, серпень — останній", () => {
    expect(schoolMonthIndex("2026-09-01")).toBe(0);
    expect(schoolMonthIndex("2027-01-15")).toBe(4);
    expect(schoolMonthIndex("2027-08-31")).toBe(11);
  });
});

describe("статуси й відсутності", () => {
  it("рахує записи за кожним статусом, включно з нульовими", () => {
    const counts = statusCounts([{ status: "approved" }, { status: "approved" }, { status: "cancelled" }]);
    expect(counts).toEqual({ awaiting_decision: 0, approved: 2, rejected: 0, returned_for_revision: 0, cancelled: 1 });
  });

  it("зводить п'ятницю й понеділок одного типу в одну відсутність, а різні типи не зливає", () => {
    const groups = groupAbsences([rec("2026-11-20"), rec("2026-11-23"), rec("2026-11-24", "approved", "sick")]);
    expect(groups).toEqual([
      { leaveType: "personal", status: "approved", from: "2026-11-20", to: "2026-11-23", days: 2 },
      { leaveType: "sick", status: "approved", from: "2026-11-24", to: "2026-11-24", days: 1 },
    ]);
  });

  it("запис за двома посадами в той самий день рахує один раз", () => {
    expect(groupAbsences([rec("2026-11-18"), rec("2026-11-18")])).toHaveLength(1);
    expect(groupAbsences([rec("2026-11-18"), rec("2026-11-18")])[0]?.days).toBe(1);
  });

  it("найближча відсутність — схвалена або та, що чекає; відхилені й скасовані не беруться", () => {
    const absences = groupAbsences([
      rec("2026-11-16", "rejected"),
      rec("2026-11-17", "cancelled"),
      rec("2026-11-18", "awaiting_decision"),
      rec("2026-12-04", "approved"),
      rec("2026-11-04", "approved"),
    ]);
    const next = nextAbsence(absences, "2026-11-13");
    expect(next).toMatchObject({ from: "2026-11-18", status: "awaiting_decision", daysUntil: 5 });
    expect(nextAbsence(absences, "2026-12-05")).toBeNull();
  });

  it("рахує дні за місяцями лише свого навчального року", () => {
    const counts = monthlyCounts(["2026-09-15", "2026-09-16", "2026-11-04", "2027-09-01", "2026-08-31"], 2026);
    expect(counts[0]).toBe(2);
    expect(counts[2]).toBe(1);
    expect(counts.reduce((sum, value) => sum + value, 0)).toBe(3);
  });
});

describe("огляд команди", () => {
  const team = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
    { id: "d", name: "D" },
  ];

  it("сьогодні відсутні лише ті, чий запис схвалено; покриття від розміру команди", () => {
    const overview = buildTeamOverview({
      team,
      records: [
        { employeeId: "a", date: "2026-11-13", status: "approved", leaveType: "sick" },
        { employeeId: "b", date: "2026-11-13", status: "awaiting_decision", leaveType: "personal" },
      ],
      closures: [],
      today: "2026-11-13",
    });
    expect(overview.outToday.map((member) => member.name)).toEqual(["A"]);
    expect(overview.coveragePercent).toBe(75);
    expect(overview.size).toBe(4);
  });

  it("теплова карта пропускає вихідні, позначає закриті дні й віддає схвалений запис замість того, що чекає", () => {
    const overview = buildTeamOverview({
      team,
      records: [
        { employeeId: "a", date: "2026-11-16", status: "awaiting_decision", leaveType: "personal" },
        { employeeId: "a", date: "2026-11-16", status: "approved", leaveType: "personal" },
      ],
      closures: [{ name: "Day off", startsOn: "2026-11-17", endsOn: "2026-11-17", closedFrom: null }],
      today: "2026-11-13",
      windowDays: 4,
    });
    expect(overview.days).toEqual(["2026-11-13", "2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(overview.rows[0]?.cells).toEqual([null, "approved", "closed", null]);
  });

  it("день ризику — найнижче покриття з урахуванням заявок, що чекають; без відсутностей його немає", () => {
    const empty = buildTeamOverview({ team, records: [], closures: [], today: "2026-11-13" });
    expect(empty.riskDay).toBeNull();
    expect(empty.coveragePercent).toBe(100);

    const risky = buildTeamOverview({
      team,
      records: [
        { employeeId: "a", date: "2026-11-18", status: "awaiting_decision", leaveType: "personal" },
        { employeeId: "b", date: "2026-11-18", status: "approved", leaveType: "sick" },
        { employeeId: "c", date: "2026-11-19", status: "approved", leaveType: "sick" },
      ],
      closures: [],
      today: "2026-11-13",
    });
    expect(risky.riskDay).toEqual({ date: "2026-11-18", percent: 50 });
  });

  it("порожня команда не ділить на нуль", () => {
    const overview = buildTeamOverview({ team: [], records: [], closures: [], today: "2026-11-13" });
    expect(overview.coveragePercent).toBe(100);
    expect(overview.rows).toEqual([]);
  });

  it("місячна статистика й розподіл за типами не враховують відхилені та скасовані", () => {
    const overview = buildTeamOverview({
      team,
      records: [
        { employeeId: "a", date: "2026-11-18", status: "approved", leaveType: "sick" },
        { employeeId: "b", date: "2026-11-19", status: "awaiting_decision", leaveType: "personal" },
        { employeeId: "c", date: "2026-11-20", status: "rejected", leaveType: "personal" },
        { employeeId: "d", date: "2026-11-23", status: "cancelled", leaveType: "family" },
      ],
      closures: [],
      today: "2026-11-13",
    });
    expect(overview.monthly[2]).toBe(2);
    expect(overview.mix).toEqual({ sick: 1, personal: 1, unpaid: 0, family: 0 });
  });
});
