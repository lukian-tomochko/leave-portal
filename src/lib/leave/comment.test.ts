import { describe, expect, it } from "vitest";
import { planRequest } from "./request";
import type { Position } from "./types";

// Посади з AC-LEAVE-02: основна (пн–пт 08:30–15:30) і додаткова (пн 15:45–17:00). 2026-11-02 — понеділок.
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
const CONTEXT = { positions: [MAIN, ADDITIONAL] };

const RELATIONSHIP_MESSAGE =
  "State your relationship to this person: sibling, child, parent, grandchild or grandparent. Not applicable to cousins, friends, neighbours or siblings-in-law";

describe("спорідненість для Family celebration", () => {
  it("AC-LEAVE-12: без спорідненості заявку не створено й показано повідомлення PM", () => {
    const result = planRequest({ leaveType: "family", dates: ["2026-11-02"], positionIds: ["main"] }, CONTEXT);

    expect(result).toEqual({ ok: false, code: "RELATIONSHIP_REQUIRED", message: RELATIONSHIP_MESSAGE });
    expect("records" in result).toBe(false);
  });

  it("невідома спорідненість (наприклад, cousin) теж відхиляється тим самим повідомленням", () => {
    const result = planRequest(
      { leaveType: "family", dates: ["2026-11-02"], positionIds: ["main"], relationship: "cousin" as never },
      CONTEXT,
    );

    expect(result).toMatchObject({ ok: false, code: "RELATIONSHIP_REQUIRED", message: RELATIONSHIP_MESSAGE });
  });

  it("зі спорідненістю з переліку заявка проходить і несе її далі", () => {
    const result = planRequest(
      { leaveType: "family", dates: ["2026-11-02"], positionIds: ["main"], relationship: "grandparent" },
      CONTEXT,
    );

    expect(result).toMatchObject({ ok: true, relationship: "grandparent" });
  });

  it("для інших типів відпустки спорідненість не потрібна й не зберігається", () => {
    const result = planRequest(
      { leaveType: "sick", dates: ["2026-11-02"], positionIds: ["main"], relationship: "parent" },
      CONTEXT,
    );

    expect(result).toMatchObject({ ok: true, relationship: undefined });
  });
});

describe("коментар до заявки", () => {
  it("AC-LEAVE-17: коментар потрапляє на обидва записи заявки на двох посадах", () => {
    const result = planRequest(
      { leaveType: "sick", dates: ["2026-11-02"], positionIds: ["main", "additional"], comment: "Doctor's appointment" },
      CONTEXT,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(2);
      expect(result.records.map((record) => record.comment)).toEqual(["Doctor's appointment", "Doctor's appointment"]);
    }
  });

  it("без коментаря записи не мають його", () => {
    const result = planRequest({ leaveType: "sick", dates: ["2026-11-02"], positionIds: ["main"] }, CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.comment).toBeUndefined();
      expect(result.records[0].comment).toBeUndefined();
    }
  });

  it("AC-LEAVE-18: коментар із 501 символу відхиляється повідомленням PM і без записів", () => {
    const result = planRequest(
      { leaveType: "sick", dates: ["2026-11-02"], positionIds: ["main"], comment: "a".repeat(501) },
      CONTEXT,
    );

    expect(result).toEqual({ ok: false, code: "COMMENT_TOO_LONG", message: "The comment can be at most 500 characters" });
    expect("records" in result).toBe(false);
  });

  it("коментар рівно з 500 символів приймається", () => {
    const result = planRequest(
      { leaveType: "sick", dates: ["2026-11-02"], positionIds: ["main"], comment: "a".repeat(500) },
      CONTEXT,
    );

    expect(result.ok).toBe(true);
  });

  it("довжину рахують у символах: 500 емодзі — це 500 символів, а не 1000", () => {
    const result = planRequest(
      { leaveType: "sick", dates: ["2026-11-02"], positionIds: ["main"], comment: "😀".repeat(500) },
      CONTEXT,
    );

    expect(result.ok).toBe(true);
  });
});
