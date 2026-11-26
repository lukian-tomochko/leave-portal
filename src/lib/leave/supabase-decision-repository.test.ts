// Адаптер рішень: що саме йде у функцію бази decide_leave_record (без справжньої бази).
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseDecisionRepository, decideArgs } from "./supabase-decision-repository";

describe("аргументи рішення для бази", () => {
  it("AC-CAL-20: знімок частки дня (150 із 420 хвилин) іде в p_counted_minutes і p_day_minutes", () => {
    expect(decideArgs("r1", "approved", null, undefined, { countedMinutes: 150, dayMinutes: 420 })).toEqual({
      p_record_id: "r1",
      p_decision: "approved",
      p_comment: undefined,
      p_paid_share: undefined,
      p_unpaid_share: 0,
      p_counted_minutes: 150,
      p_day_minutes: 420,
    });
  });

  it("AC-CAL-20: без знімка база отримує порожні хвилини, розподіл іде в частках дня", () => {
    const args = decideArgs("r1", "approved", "ok", { paidCents: 50, unpaidCents: 50 });

    expect(args).toMatchObject({ p_comment: "ok", p_paid_share: 0.5, p_unpaid_share: 0.5 });
    expect(args.p_counted_minutes).toBeUndefined();
    expect(args.p_day_minutes).toBeUndefined();
  });

  it("AC-CAL-20: адаптер передає знімок у виклик decide_leave_record і повертає результат бази", async () => {
    const rpc = vi.fn(async () => ({ data: { ok: true, status: "approved" }, error: null }));
    const repository = createSupabaseDecisionRepository({ rpc } as unknown as SupabaseClient<Database>);

    const result = await repository.decide("r1", "approved", null, undefined, { countedMinutes: 210, dayMinutes: 210 });

    expect(result).toEqual({ ok: true, status: "approved" });
    expect(rpc).toHaveBeenCalledWith(
      "decide_leave_record",
      expect.objectContaining({ p_record_id: "r1", p_counted_minutes: 210, p_day_minutes: 210 }),
    );
  });
});
