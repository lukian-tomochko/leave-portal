import { describe, expect, it } from "vitest";
import {
  type ApprovedRecord,
  type BalanceInputs,
  balancesForYear,
  balancesOn,
  planApproval,
  requestWarning,
  schoolYearOf,
  splitText,
  suggestSplit,
  workingMinutes,
} from "./balance";
import type { LeaveType, Position } from "./types";

// Дані з прикладів PM (requirements/03-leave-balance.md). Основна посада: пн–пт 08:30–15:30 (420 хв), додаткова: пн 15:45–17:00 (75 хв).
const MAIN: Position = {
  id: "main",
  kind: "main",
  division: "Elementary school",
  jobTitle: "Teacher",
  blocks: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "08:30", endsAt: "15:30" })),
};
const ADDITIONAL: Position = {
  id: "additional",
  kind: "additional",
  division: "High school",
  jobTitle: "Math teacher",
  blocks: [{ weekday: 1, startsAt: "15:45", endsAt: "17:00" }],
};

// Схвалений запис: за замовчуванням цілий день основної посади.
function approved(
  date: string,
  leaveType: LeaveType,
  options: { positionId?: string; startsAt?: string; endsAt?: string; unpaidCents?: number; paidCents?: number | null } = {},
): ApprovedRecord {
  return {
    id: `${leaveType}-${date}-${options.positionId ?? "main"}`,
    positionId: options.positionId ?? "main",
    date,
    startsAt: options.startsAt ?? "08:30",
    endsAt: options.endsAt ?? "15:30",
    leaveType,
    paidCents: options.paidCents ?? null,
    unpaidCents: options.unpaidCents ?? 0,
  };
}

// n робочих днів (пн–пт) від дати включно.
function workdays(from: string, count: number): string[] {
  const days: string[] = [];
  const day = new Date(`${from}T00:00:00Z`);
  while (days.length < count) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      days.push(day.toISOString().slice(0, 10));
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return days;
}

// Використано `whole` цілих днів і, за потреби, ще одну частку (в хвилинах основної посади) певного типу від 2026-09-01.
function used(leaveType: LeaveType, whole: number, partMinutes = 0): ApprovedRecord[] {
  const days = workdays("2026-09-01", whole + (partMinutes ? 1 : 0));
  const records = days.slice(0, whole).map((date) => approved(date, leaveType));
  if (partMinutes) {
    const end = 8 * 60 + 30 + partMinutes;
    const endsAt = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
    records.push(approved(days[whole], leaveType, { startsAt: "08:30", endsAt }));
  }
  return records;
}

const inputs = (records: ApprovedRecord[], positions: Position[] = [MAIN]): BalanceInputs => ({ positions, records });
const WHOLE_DAY = (date: string, positionId = "main") => ({
  positionId,
  date,
  startsAt: "08:30",
  endsAt: "15:30",
});

describe("баланси працівника", () => {
  it("AC-BALANCE-01: без схвалених записів «Sick leave» і «Personal leave» — 18.00 / 0.00 / 18.00, «Unpaid leave» і «Family celebration» — лише використано 0.00", () => {
    const balances = balancesOn(inputs([]), "2026-11-02");

    expect(balances.label).toBe("2026–2027");
    expect(balances.sick).toEqual({ granted: 18, carriedOver: 0, used: 0, remaining: 18 });
    expect(balances.personal).toEqual({ granted: 18, carriedOver: 0, used: 0, remaining: 18 });
    expect(balances.unpaid).toEqual({ used: 0 });
    expect(balances.family).toEqual({ used: 0 });
  });

  it("AC-BALANCE-02: схвалений запис «Sick leave» на цілий день 2026-11-03 дає використано 1.00, залишок 17.00", () => {
    const balances = balancesOn(inputs([approved("2026-11-03", "sick")]), "2026-11-03");

    expect(balances.sick).toMatchObject({ used: 1, remaining: 17 });
  });

  it("AC-BALANCE-03: схвалений запис «Sick leave» 09:00–11:30 (150 хв із 420) дає використано 0.36, залишок 17.64", () => {
    const record = approved("2026-11-03", "sick", { startsAt: "09:00", endsAt: "11:30" });

    const balances = balancesOn(inputs([record]), "2026-11-03");

    expect(balances.sick).toMatchObject({ used: 0.36, remaining: 17.64 });
  });

  it("AC-BALANCE-05: схвалені цілі дні двох посад на 2026-11-02 разом дають використано 1.00, а не 2.00", () => {
    const records = [
      approved("2026-11-02", "personal"),
      approved("2026-11-02", "personal", { positionId: "additional", startsAt: "15:45", endsAt: "17:00" }),
    ];

    const balances = balancesOn(inputs(records, [MAIN, ADDITIONAL]), "2026-11-02");

    expect(balances.personal.used).toBe(1);
  });

  it("AC-BALANCE-06: цілий день лише додаткової посади (75 хв із 495) дає використано 0.15", () => {
    const record = approved("2026-11-02", "personal", { positionId: "additional", startsAt: "15:45", endsAt: "17:00" });

    expect(workingMinutes([MAIN, ADDITIONAL], "2026-11-02")).toBe(495);
    const balances = balancesOn(inputs([record], [MAIN, ADDITIONAL]), "2026-11-02");

    expect(balances.personal.used).toBe(0.15);
  });

  it("AC-BALANCE-11: залишок 5.00 «Sick leave» на 2027-08-31 переноситься: на 2027-09-01 — 18.00 + 5.00 перенесено = 23.00", () => {
    const records = used("sick", 13); // використано 13.00 із 18.00 у 2026–2027

    const before = balancesOn(inputs(records), "2027-08-31");
    const after = balancesOn(inputs(records), "2027-09-01");

    expect(before.sick.remaining).toBe(5);
    expect(after.label).toBe("2027–2028");
    expect(after.sick).toEqual({ granted: 18, carriedOver: 5, used: 0, remaining: 23 });
  });

  it("AC-BALANCE-21: запис 2027-08-30, схвалений пізніше, зменшує залишок 2026–2027 до 4.00 і перенесення в 2027–2028 до 4.00 (залишок 22.00)", () => {
    const records = [...used("sick", 13), approved("2027-08-30", "sick")];

    const previous = balancesForYear(inputs(records), 2026);
    const next = balancesForYear(inputs(records), 2027);

    expect(previous.sick.remaining).toBe(4);
    expect(next.sick).toMatchObject({ carriedOver: 4, remaining: 22 });
  });

  it("AC-BALANCE-22: запис на 2027-08-31 і запис на 2027-09-01 додають по 1.00 використаного в обох навчальних роках", () => {
    const records = [approved("2027-08-31", "personal"), approved("2027-09-01", "personal")];

    expect(schoolYearOf("2027-08-31")).toBe(2026);
    expect(schoolYearOf("2027-09-01")).toBe(2027);
    expect(balancesForYear(inputs(records), 2026).personal.used).toBe(1);
    expect(balancesForYear(inputs(records), 2027).personal.used).toBe(1);
  });

  it("частка дня заокруглюється half up: 355 хв із 1000 робочих хвилин дають 0.36 (припущення PM: 0.355 → 0.36)", () => {
    const long: Position = { ...MAIN, blocks: [{ weekday: 2, startsAt: "00:00", endsAt: "16:40" }] }; // 1000 хв
    const record = approved("2026-11-03", "personal", { startsAt: "00:00", endsAt: "05:55" }); // 355 хв

    expect(balancesOn(inputs([record], [long]), "2026-11-03").personal.used).toBe(0.36);
  });
});

describe("попередження про перевищення балансу", () => {
  it("AC-BALANCE-08: залишок «Personal leave» 0.50, заявка на цілий день 2026-11-03 дає «Your Personal leave balance is 0.50 day. Another 0.50 day will be counted as Unpaid leave»", () => {
    const state = inputs(used("personal", 17, 210)); // використано 17.50

    const warning = requestWarning(state, "personal", [WHOLE_DAY("2026-11-03")]);

    expect(warning).toBe("Your Personal leave balance is 0.50 day. Another 0.50 day will be counted as Unpaid leave");
  });

  it("AC-BALANCE-15: залишок 0.20, запит 09:00–11:30 (0.36 дня) дає «Your Personal leave balance is 0.20 day. Another 0.16 day will be counted as Unpaid leave»", () => {
    const state = inputs(used("personal", 17, 336)); // використано 17.80

    const warning = requestWarning(state, "personal", [
      { positionId: "main", date: "2026-11-03", startsAt: "09:00", endsAt: "11:30" },
    ]);

    expect(warning).toBe("Your Personal leave balance is 0.20 day. Another 0.16 day will be counted as Unpaid leave");
  });

  it("AC-BALANCE-17: залишок 1.50 і заявка на три цілі дні в одному запиті дають одне попередження «…balance is 1.50 day. Another 1.50 day…»", () => {
    const state = inputs(used("personal", 16, 210)); // використано 16.50
    const planned = ["2026-11-02", "2026-11-03", "2026-11-04"].map((date) => WHOLE_DAY(date));

    const warning = requestWarning(state, "personal", planned);

    expect(warning).toBe("Your Personal leave balance is 1.50 day. Another 1.50 day will be counted as Unpaid leave");
  });

  it("заявка в межах балансу й заявки інших типів не дають попередження", () => {
    const state = inputs(used("personal", 5));

    expect(requestWarning(state, "personal", [WHOLE_DAY("2026-11-03")])).toBeNull();
    expect(requestWarning(inputs(used("sick", 18)), "sick", [WHOLE_DAY("2026-11-03")])).toBeNull();
    expect(requestWarning(inputs(used("unpaid", 30)), "unpaid", [WHOLE_DAY("2026-11-03")])).toBeNull();
  });
});

describe("схвалення з розподілом", () => {
  const exceeding = () => inputs(used("personal", 17, 210)); // залишок 0.50
  const record = { leaveType: "personal" as const, ...WHOLE_DAY("2026-11-03") };

  it("AC-BALANCE-09: менеджер бачить «This request exceeds the Personal leave balance (0.50 day). Suggested: 0.50 day Personal leave, 0.50 day Unpaid leave»", () => {
    const suggestion = suggestSplit(exceeding(), record);

    expect(suggestion?.message).toBe(
      "This request exceeds the Personal leave balance (0.50 day). Suggested: 0.50 day Personal leave, 0.50 day Unpaid leave",
    );
    expect(suggestion).toMatchObject({ paidCents: 50, unpaidCents: 50 });
  });

  it("AC-BALANCE-10: після схвалення з розподілом «Personal leave» — використано 18.00, залишок 0.00, «Unpaid leave» — використано 0.50", () => {
    const state = exceeding();
    const plan = planApproval(state, record, true);
    expect(plan).toEqual({ ok: true, paidCents: 50, unpaidCents: 50 });

    const decided = approved("2026-11-03", "personal", { paidCents: 50, unpaidCents: 50 });
    const balances = balancesOn({ ...state, records: [...state.records, decided] }, "2026-11-03");

    expect(balances.personal).toMatchObject({ used: 18, remaining: 0 });
    expect(balances.unpaid.used).toBe(0.5);
  });

  it("AC-BALANCE-16: схвалити запис повністю як «Personal leave» без розподілу не можна, менеджер бачить «The Personal leave balance is 0.50 day: approve with the suggested split or reject»", () => {
    const plan = planApproval(exceeding(), record, false);

    expect(plan).toEqual({
      ok: false,
      code: "SPLIT_REQUIRED",
      message: "The Personal leave balance is 0.50 day: approve with the suggested split or reject",
    });
  });

  it("AC-BALANCE-14: після схвалення запису 2026-11-03 менеджер бачить для 2026-11-04 попередження про залишок 0.50 з розподілом 0.50 + 0.50", () => {
    const before = inputs(used("personal", 16, 210)); // залишок 1.50
    const first = approved("2026-11-03", "personal");

    const suggestion = suggestSplit({ ...before, records: [...before.records, first] }, { leaveType: "personal", ...WHOLE_DAY("2026-11-04") });

    expect(suggestion?.message).toBe(
      "This request exceeds the Personal leave balance (0.50 day). Suggested: 0.50 day Personal leave, 0.50 day Unpaid leave",
    );
  });

  it("AC-BALANCE-18: схвалений з розподілом запис показується як «0.50 Personal leave + 0.50 Unpaid leave»", () => {
    expect(splitText(50, 50)).toBe("0.50 Personal leave + 0.50 Unpaid leave");
    expect(splitText(null, 0)).toBeNull();
  });

  it("AC-BALANCE-19: при залишку 0.00 запис зберігає тип «Personal leave» із розподілом «0.00 Personal leave + 1.00 Unpaid leave», «Unpaid leave» — використано 1.00", () => {
    const state = inputs(used("personal", 18)); // залишок 0.00
    const plan = planApproval(state, record, true);
    expect(plan).toEqual({ ok: true, paidCents: 0, unpaidCents: 100 });

    const decided = approved("2026-11-03", "personal", { paidCents: 0, unpaidCents: 100 });
    const balances = balancesOn({ ...state, records: [...state.records, decided] }, "2026-11-03");

    expect(splitText(0, 100)).toBe("0.00 Personal leave + 1.00 Unpaid leave");
    expect(balances.unpaid.used).toBe(1);
    expect(balances.personal.remaining).toBe(0);
  });

  it("запис у межах балансу схвалюється без розподілу", () => {
    expect(planApproval(inputs(used("personal", 5)), record, false)).toEqual({ ok: true, paidCents: null, unpaidCents: 0 });
    expect(suggestSplit(inputs(used("personal", 5)), record)).toBeNull();
  });
});
