// Повідомлення про помилку сервера (WS11, трек B): що йде в Telegram, а що — ніколи. Назви тестів без AC ID: це технічна
// перевірка, а не критерій приймання.
import { afterEach, describe, expect, it, vi } from "vitest";
import { SAME_ERROR_PAUSE_MS, alertText, claimSlot, sendTelegram, stackFrames } from "./error-alert";

const SECRET_MESSAGE = "Failed for olena.test@example.test with password hunter2";
const context = { routePath: "/requests/[id]", routeType: "render", routerKind: "App Router" };

function errorWithStack(message: string, frames: string[]): Error {
  const error = new Error(message);
  error.stack = [`${error.name}: ${message}`, ...frames.map((frame) => `    ${frame}`)].join("\n");
  return error;
}

describe("stackFrames", () => {
  it("відкидає заголовок з текстом помилки, лишає лише рядки «at …»", () => {
    const error = errorWithStack(`${SECRET_MESSAGE}\nдругий рядок із даними`, [
      "at Page (src/app/requests/[id]/page.tsx:12:9)",
      "at render (node_modules/next/dist/server/render.js:5:1)",
    ]);

    const frames = stackFrames(error);

    expect(frames).toEqual(["at Page (src/app/requests/[id]/page.tsx:12:9)", "at render (node_modules/next/dist/server/render.js:5:1)"]);
    expect(frames.join("\n")).not.toContain("olena.test");
  });

  it("скорочує абсолютні шляхи (Windows і Linux), щоб ім'я користувача ОС не потрапило в чат", () => {
    const error = errorWithStack("boom", [
      "at Page (C:\\Users\\olena\\work\\leave-portal\\src\\app\\page.tsx:3:7)",
      "at run (/home/olena/repo/node_modules/next/dist/x.js:9:2)",
      "at chunk (/vercel/path0/.next/server/chunks/ssr/a.js:1:1)",
    ]);

    const text = stackFrames(error).join("\n");

    expect(text).toContain("at Page (src/app");
    expect(text).toContain("page.tsx:3:7");
    expect(text).toContain("node_modules/next/dist/x.js:9:2");
    expect(text).toContain(".next/server/chunks/ssr/a.js:1:1");
    expect(text).not.toContain("olena");
    expect(text).not.toContain("/vercel/path0");
  });

  it("бере не більше п'яти рядків, кожен не довший за 160 символів, а не-помилку чи стек без «at» дає порожнім", () => {
    const many = Array.from({ length: 9 }, (_, i) => `at f${i} (src/${"x".repeat(200)}.ts:${i + 1}:1)`);

    expect(stackFrames(errorWithStack("boom", many))).toHaveLength(5);
    expect(Math.max(...stackFrames(errorWithStack("boom", many)).map((line) => line.length))).toBeLessThanOrEqual(160);
    expect(stackFrames("not an error")).toEqual([]);
    expect(stackFrames(errorWithStack("boom", ["без рядків at"]))).toEqual([]);
  });
});

describe("alertText", () => {
  it("містить середовище, гілку, маршрут, метод, digest і коміт, але не error.message й не заголовки запиту", () => {
    const error = Object.assign(errorWithStack(SECRET_MESSAGE, ["at Page (src/app/page.tsx:1:1)"]), { digest: "d1g3st" });
    const request = Object.assign({ method: "GET" }, { headers: { cookie: "sb-access-token=hunter2" }, path: "/requests/42?token=hunter2" });

    const text = alertText(error, request, context, {
      APP_ENV: "staging",
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "staging",
      VERCEL_GIT_COMMIT_SHA: "0123456789abcdef",
      VERCEL_DEPLOYMENT_ID: "dpl_123",
    });

    expect(text).toContain("SERVER ERROR");
    expect(text).toContain("Environment: staging (branch staging)");
    expect(text).toContain("Route: GET /requests/[id] (render, App Router)");
    expect(text).toContain("Error: Error, digest d1g3st");
    expect(text).toContain("Deploy: dpl_123, commit 0123456");
    expect(text).toContain("at Page (src/app/page.tsx:1:1)");
    for (const secret of ["olena.test", "hunter2", "sb-access-token", "token="]) expect(text).not.toContain(secret);
  });

  it("без APP_ENV бере VERCEL_ENV, а без обох — local", () => {
    expect(alertText(new Error("x"), { method: "POST" }, context, { VERCEL_ENV: "production" })).toContain("Environment: production");
    expect(alertText(new Error("x"), { method: "POST" }, context, {})).toContain("Environment: local");
  });
});

describe("claimSlot", () => {
  it("та сама помилка на тому самому маршруті — не частіше разу на хвилину, інша — одразу", () => {
    const error = new TypeError("x");
    const start = 1_000_000;

    expect(claimSlot(error, "/pause-a", start)).toBe(true);
    expect(claimSlot(error, "/pause-a", start + SAME_ERROR_PAUSE_MS - 1)).toBe(false);
    expect(claimSlot(error, "/pause-b", start + 1)).toBe(true);
    expect(claimSlot(new RangeError("y"), "/pause-a", start + 1)).toBe(true);
    expect(claimSlot(error, "/pause-a", start + SAME_ERROR_PAUSE_MS)).toBe(true);
  });
});

describe("sendTelegram", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("шле один POST у Bot API з chat_id і текстом", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await sendTelegram("SERVER ERROR", "123:token", "-100");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:token/sendMessage");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ chat_id: "-100", text: "SERVER ERROR" });
  });

  it("збій мережі не кидає виняток і нічого не пише в журнал: помилка fetch містить адресу з токеном бота", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("failed to fetch https://api.telegram.org/bot123:token/sendMessage"))));
    const spies = (["log", "info", "warn", "error"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));

    await expect(sendTelegram("x", "123:token", "-100")).resolves.toBeUndefined();

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
