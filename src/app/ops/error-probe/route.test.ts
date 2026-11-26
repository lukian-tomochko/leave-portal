import { beforeEach, describe, expect, it, vi } from "vitest";

// Маршрут навмисної помилки: помилку створює лише адміністратор; без входу — 401, звичайний користувач — 403.
// Назви тестів без AC ID: це технічна перевірка операційного завдання, а не критерій вимог PM.
const mocks = vi.hoisted(() => ({
  claimsSub: "u1" as string | null,
  role: "admin" as string | null,
  profileError: null as { code: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: mocks.claimsSub ? { sub: mocks.claimsSub } : null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.role ? { role: mocks.role } : null, error: mocks.profileError }),
        }),
      }),
    }),
  }),
}));

import { GET } from "./route";

describe("/ops/error-probe", () => {
  beforeEach(() => {
    mocks.claimsSub = "u1";
    mocks.role = "admin";
    mocks.profileError = null;
  });

  it("без входу відповідає 401 і не кидає помилку", async () => {
    mocks.claimsSub = null;
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("працівник і менеджер отримують 403 і не створюють помилку", async () => {
    for (const role of ["employee", "manager"]) {
      mocks.role = role;
      const response = await GET();
      expect(response.status).toBe(403);
    }
  });

  it("помилка читання профілю теж закриває маршрут (403)", async () => {
    mocks.profileError = { code: "XX000" };
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("адміністратор викликає навмисну помилку сервера", async () => {
    await expect(GET()).rejects.toThrow("deliberate test error");
  });
});
