import { describe, expect, it } from "vitest";
import { formKey, summaryKey, type FormKeyValues } from "./form-key";
import type { RequestInput } from "./types";

// Регресія відхилення issue 104: після «Show summary» підсумок не з'являвся, бо ключ поточної форми й ключ підсумку з сервера
// збирались з однакових значень, але в різному порядку полів. Тут: однакові значення дають однаковий ключ, а зміна будь-якого
// значення — інший (підсумок застаріває).
const form: FormKeyValues = {
  leaveType: "personal",
  dates: ["2026-12-07"],
  positionIds: ["p1"],
  mode: "whole-day",
  startsAt: "",
  endsAt: "",
  relationship: "",
  comment: "",
};
const server: RequestInput = { leaveType: "personal", dates: ["2026-12-07"], positionIds: ["p1"] };

describe("ключ підсумку заявки", () => {
  it("AC-LEAVE-01: підсумок із сервера відповідає значенням форми, з яких його запитали", () => {
    expect(summaryKey(server)).toBe(formKey(form));
  });

  it("AC-LEAVE-01: порядок полів у об'єкті не впливає на ключ (регресія issue 104)", () => {
    const reordered: FormKeyValues = {
      comment: form.comment,
      relationship: form.relationship,
      endsAt: form.endsAt,
      startsAt: form.startsAt,
      mode: form.mode,
      positionIds: form.positionIds,
      dates: form.dates,
      leaveType: form.leaveType,
    };
    expect(formKey(reordered)).toBe(formKey(form));
  });

  it("AC-LEAVE-01: порядок і дублі дат та посад не впливають на ключ", () => {
    const a = formKey({ ...form, dates: ["2026-12-08", "2026-12-07", "2026-12-07"], positionIds: ["p2", "p1"] });
    const b = formKey({ ...form, dates: ["2026-12-07", "2026-12-08"], positionIds: ["p1", "p2", "p1"] });
    expect(a).toBe(b);
  });

  it("AC-LEAVE-05: підсумок для годин збігається з формою в режимі «Hours»", () => {
    const hours: RequestInput = { ...server, hours: { startsAt: "09:00", endsAt: "11:30" } };
    expect(summaryKey(hours)).toBe(formKey({ ...form, mode: "hours", startsAt: "09:00", endsAt: "11:30" }));
  });

  it("AC-LEAVE-17: коментар порівнюється без крайніх пробілів, а родинний зв'язок враховується", () => {
    const family: RequestInput = { leaveType: "family", dates: ["2026-12-07"], positionIds: ["p1"], relationship: "child", comment: "  Flu  " };
    expect(summaryKey(family)).toBe(formKey({ ...form, leaveType: "family", relationship: "child", comment: "Flu" }));
  });

  it("AC-LEAVE-11: зміна будь-якого значення форми робить підсумок застарілим", () => {
    const base = summaryKey(server);
    const changes: Partial<FormKeyValues>[] = [
      { leaveType: "sick" },
      { dates: ["2026-12-07", "2026-12-08"] },
      { positionIds: ["p1", "p2"] },
      { mode: "hours", startsAt: "09:00", endsAt: "10:00" },
      { relationship: "child" },
      { comment: "Changed" },
    ];
    for (const change of changes) {
      expect(formKey({ ...form, ...change })).not.toBe(base);
    }
  });
});
