// D0: /api/health відрізняє «база відповіла» від «база недоступна, призупинена чи ключ хибний».
import { describe, expect, it } from "vitest";
import { appEnvFrom, classifyDbProbe, supabaseRefFrom } from "@/lib/health";

describe("classifyDbProbe (/api/health)", () => {
  it("рахує базу живою, коли запит пройшов або Postgres відмовив у правах (42501)", () => {
    expect(classifyDbProbe({ status: 200, error: null })).toEqual({ db: "ok", reason: "" });
    expect(classifyDbProbe({ status: 401, error: { code: "42501", message: "permission denied for table profiles" } })).toEqual({
      db: "ok",
      reason: "",
    });
    expect(classifyDbProbe({ status: 400, error: { code: "PGRST100", message: "bad filter" } }).db).toBe("ok");
  });

  it("повідомляє «paused», коли Supabase відповідає 540 (безкоштовний проєкт призупинено)", () => {
    expect(classifyDbProbe({ status: 540, error: { message: "project paused" } })).toEqual({ db: "down", reason: "paused" });
  });

  it("повідомляє про хибний публічний ключ", () => {
    expect(classifyDbProbe({ status: 401, error: { message: "Invalid API key" } })).toEqual({
      db: "down",
      reason: "invalid-api-key",
    });
  });

  it("повідомляє код, коли PostgREST не дістає до бази або мережі немає", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "PGRST002", message: "schema cache" } })).toEqual({
      db: "down",
      reason: "status-503-PGRST002",
    });
    expect(classifyDbProbe({ status: 0, error: { message: "fetch failed" } })).toEqual({ db: "down", reason: "status-0" });
  });

  it("лишає 42501 живою базою навіть зі статусом 5xx, а нерозпізнану відповідь 4xx рахує недоступною з кодом", () => {
    expect(classifyDbProbe({ status: 500, error: { code: "42501", message: "permission denied" } })).toEqual({ db: "ok", reason: "" });
    expect(classifyDbProbe({ status: 404, error: { code: "x", message: "not found" } })).toEqual({
      db: "down",
      reason: "status-404-x",
    });
    expect(classifyDbProbe({ status: 404, error: { code: "x" } })).toEqual({ db: "down", reason: "status-404-x" });
    expect(classifyDbProbe({ status: 404, error: {} })).toEqual({ db: "down", reason: "status-404" });
  });

  it("не рахує базу живою, коли сервер відповів помилкою 5xx із SQLSTATE чи кодом PostgREST", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "53300", message: "too many connections" } })).toEqual({
      db: "down",
      reason: "status-503-53300",
    });
    expect(classifyDbProbe({ status: 500, error: { code: "PGRST300", message: "JWT secret missing" } })).toEqual({
      db: "down",
      reason: "status-500-PGRST300",
    });
  });
});

describe("supabaseRefFrom і appEnvFrom (/api/health, WS11)", () => {
  it("дістає ref проєкту з публічної адреси Supabase", () => {
    expect(supabaseRefFrom("https://abcdefghijklmnop.supabase.co")).toBe("abcdefghijklmnop");
    expect(supabaseRefFrom("https://AbCd1234.supabase.co/")).toBe("abcd1234");
    expect(supabaseRefFrom(" https://abcd1234.supabase.co/rest/v1 ")).toBe("abcd1234");
  });

  it("не вигадує ref для чужої, локальної чи порожньої адреси", () => {
    expect(supabaseRefFrom(undefined)).toBe("");
    expect(supabaseRefFrom("")).toBe("");
    expect(supabaseRefFrom("http://127.0.0.1:54321")).toBe("");
    expect(supabaseRefFrom("https://evil.example.com/abcd1234.supabase.co")).toBe("");
    expect(supabaseRefFrom("https://abcd1234.supabase.co.evil.example.com")).toBe("");
  });

  it("бере APP_ENV з пріоритетом над VERCEL_ENV", () => {
    expect(appEnvFrom({ APP_ENV: "staging", VERCEL_ENV: "preview" })).toBe("staging");
    expect(appEnvFrom({ APP_ENV: "  ", VERCEL_ENV: "preview" })).toBe("preview");
    expect(appEnvFrom({ VERCEL_ENV: "production" })).toBe("production");
    expect(appEnvFrom({})).toBe("local");
  });
});
