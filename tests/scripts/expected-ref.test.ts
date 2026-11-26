// Дія з postmortem 2026-11-26-staging-supabase-url: smoke називає хибний supabaseRef (scripts/lib/expected-ref.mjs).
import { describe, expect, it } from "vitest";
import { supabaseRefProblem } from "../../scripts/lib/expected-ref.mjs";

const STAGING = "nvahbpcqsouhzqmwqctm";
const PROD = "quxrineulrgegydlmbow";

describe("supabaseRefProblem", () => {
  it("не скаржиться, коли ref збігається (регістр і пробіли не важливі) або перевірку не задано", () => {
    expect(supabaseRefProblem(STAGING, STAGING)).toBe("");
    expect(supabaseRefProblem(` ${STAGING.toUpperCase()} `, STAGING)).toBe("");
    expect(supabaseRefProblem("будь-що", "")).toBe("");
    expect(supabaseRefProblem("будь-що", undefined)).toBe("");
  });

  it("не скаржиться, коли відповідь health ще без поля supabaseRef", () => {
    expect(supabaseRefProblem(undefined, STAGING)).toBe("");
    expect(supabaseRefProblem(null, STAGING)).toBe("");
  });

  it("називає ref дрілу: неіснуючий проєкт замість staging", () => {
    const problem = supabaseRefProblem("doesnotexist000000", STAGING);
    expect(problem).toContain("supabaseRef=doesnotexist000000");
    expect(problem).toContain(`очікуваним ${STAGING}`);
    expect(problem).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("ловить прод-ref у staging і staging-ref у проді", () => {
    expect(supabaseRefProblem(PROD, STAGING)).toContain(`supabaseRef=${PROD}`);
    expect(supabaseRefProblem(STAGING, PROD)).toContain(`supabaseRef=${STAGING}`);
  });

  it("називає змінну, коли ref порожній (адреса відсутня чи не Supabase)", () => {
    expect(supabaseRefProblem("", STAGING)).toContain("порожній");
    expect(supabaseRefProblem("", STAGING)).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });
});
