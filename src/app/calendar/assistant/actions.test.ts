import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Server Actions помічника календаря з підміненими Supabase і моделлю: перевіряємо, що роль перевіряється до моделі й до
// запису, що пропозиції нічого не пишуть, а збереження йде по рядках із повторною валідацією. Правила бази (перетини,
// блокуючі записи) доводять тести бази вимоги 04; тут rpc — фейк із відповідями за формою add_school_closure.
const mocks = vi.hoisted(() => ({
  role: "admin" as string | null,
  claimsSub: "u1" as string | null,
  rpc: vi.fn(),
  model: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
  },
}));
// Власні модулі не мокаємо: справжній productModel() читає ключ із process.env, а замість мережі — підмінений провайдер.
vi.mock("server-only", () => ({}));
vi.mock("@openrouter/ai-sdk-provider", () => ({ createOpenRouter: () => ({ chat: () => mocks.model }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: mocks.claimsSub ? { sub: mocks.claimsSub } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.role ? { role: mocks.role } : null, error: null }) }) }) }),
    rpc: mocks.rpc,
  }),
}));

import { requestSuggestions, saveSuggestions } from "./actions";
import type { AssistantState, SaveState, SuggestionRow } from "./state";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const answer = (value: unknown) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(value) }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
const WINTER = { name: "Winter break", startsOn: "2026-12-28", endsOn: "2027-01-08", closedFrom: null };
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const IDLE: AssistantState = { status: "idle" };
const IDLE_SAVE: SaveState = { status: "idle" };
const row = (key: string, name: string, startsOn: string, endsOn: string, kind: SuggestionRow["kind"] = "whole", time = ""): SuggestionRow => ({ key, name, kind, startsOn, endsOn, time });

beforeEach(() => {
  mocks.role = "admin";
  mocks.claimsSub = "u1";
  mocks.model = null;
  mocks.rpc.mockReset();
  process.env.OPENROUTER_API_KEY = "test-key"; // фіктивне значення: мережі немає, провайдер підмінено
});

describe("requestSuggestions", () => {
  it("AC-ASSIST-11: працівник бачить «Only an administrator…» без виклику моделі й без пропозицій", async () => {
    mocks.role = "employee";
    const model = answer({ status: "ok", closures: [WINTER], missing: null });
    mocks.model = model;

    const result = await requestSuggestions(IDLE, form({ text: "Winter break 28.12–08.01" }));

    expect(result).toEqual({ status: "message", kind: "error", message: "Only an administrator can change the school calendar" });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("AC-ASSIST-11: гість (без входу) перенаправляється на вхід, модель не викликається", async () => {
    mocks.claimsSub = null;
    const model = answer({ status: "ok", closures: [WINTER], missing: null });
    mocks.model = model;

    await expect(requestSuggestions(IDLE, form({ text: "x" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("AC-ASSIST-01: адміністратор отримує пропозиції на перегляд, і нічого не зберігається", async () => {
    mocks.model = answer({ status: "ok", closures: [WINTER], missing: null });

    const result = await requestSuggestions(IDLE, form({ text: "Winter break 28.12–08.01" }));

    expect(result.status).toBe("suggested");
    expect(result.status === "suggested" ? result.rows.map(({ name, kind, startsOn, endsOn, time }) => ({ name, kind, startsOn, endsOn, time })) : []).toEqual([
      { name: "Winter break", kind: "whole", startsOn: "2026-12-28", endsOn: "2027-01-08", time: "" },
    ]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("AC-ASSIST-10: текст із 2001 символу — повідомлення про 2000 символів, модель не викликається", async () => {
    const model = answer({ status: "ok", closures: [WINTER], missing: null });
    mocks.model = model;

    const result = await requestSuggestions(IDLE, form({ text: "a".repeat(2001) }));

    expect(result).toEqual({ status: "message", kind: "too_long", message: "The text can be at most 2000 characters" });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("AC-ASSIST-09: без ключа (модель null) — «unavailable» з дослівним текстом", async () => {
    delete process.env.OPENROUTER_API_KEY;

    const result = await requestSuggestions(IDLE, form({ text: "Winter break 28.12–08.01" }));

    expect(result).toEqual({
      status: "message",
      kind: "unavailable",
      message: "The calendar assistant is unavailable right now. Try again later or add closures manually.",
    });
  });
});

describe("saveSuggestions", () => {
  it("AC-ASSIST-11: працівник не зберігає закриття: повідомлення й жодного rpc", async () => {
    mocks.role = "employee";

    const result = await saveSuggestions(IDLE_SAVE, form({ rows: JSON.stringify([row("a", "Winter break", "2026-12-28", "2027-01-08")]) }));

    expect(result).toEqual({ status: "error", message: "Only an administrator can change the school calendar" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("AC-ASSIST-02: два закриття без змін зберігаються, скорочений день іде з часом", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, id: "x" }, error: null });
    const rows = [row("a", "Teachers' meeting", "2026-11-20", "2026-11-20", "early", "12:00"), row("b", "Winter break", "2026-12-28", "2027-01-08")];

    const result = await saveSuggestions(IDLE_SAVE, form({ rows: JSON.stringify(rows) }));

    expect(result).toEqual({ status: "done", results: [{ key: "a", ok: true }, { key: "b", ok: true }] });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "add_school_closure", { p_name: "Teachers' meeting", p_starts_on: "2026-11-20", p_ends_on: "2026-11-20", p_closed_from: "12:00" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "add_school_closure", { p_name: "Winter break", p_starts_on: "2026-12-28", p_ends_on: "2027-01-08" });
  });

  it("AC-ASSIST-03: збереження бере виправлену назву й лише ті рядки, що лишились після видалення", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, id: "x" }, error: null });
    // Клієнт видалив «Teachers' meeting» і перейменував «Winter break» — надсилає лише один рядок.
    const rows = [row("b", "Winter holidays", "2026-12-28", "2027-01-08")];

    const result = await saveSuggestions(IDLE_SAVE, form({ rows: JSON.stringify(rows) }));

    expect(result).toEqual({ status: "done", results: [{ key: "b", ok: true }] });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("add_school_closure", { p_name: "Winter holidays", p_starts_on: "2026-12-28", p_ends_on: "2027-01-08" });
  });

  it("AC-ASSIST-04: збережений раніше «Winter break» не дублюється, а «Staff day» зберігається; рядок має повідомлення вимоги 04", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { ok: false, code: "overlap", overlaps: [{ date: "2026-12-28", name: "Winter break" }] }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, id: "y" }, error: null });
    const rows = [row("a", "Winter break", "2026-12-28", "2027-01-08"), row("b", "Staff day", "2027-01-12", "2027-01-12")];

    const result = await saveSuggestions(IDLE_SAVE, form({ rows: JSON.stringify(rows) }));

    expect(result).toEqual({
      status: "done",
      results: [{ key: "a", ok: false, message: "2026-12-28 is already closed: Winter break" }, { key: "b", ok: true }],
    });
  });

  it("AC-ASSIST-02: підроблений рядок (неіснуюча дата, не JSON) відхиляється на сервері без запису", async () => {
    const bad = await saveSuggestions(IDLE_SAVE, form({ rows: JSON.stringify([row("a", "Holiday", "2027-02-31", "2027-02-31")]) }));
    const garbage = await saveSuggestions(IDLE_SAVE, form({ rows: "not json" }));

    expect(bad).toMatchObject({ status: "done", results: [{ key: "a", ok: false }] });
    expect(garbage).toMatchObject({ status: "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
