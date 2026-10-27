// Матриця прав PM (requirements/product.md): ім'я й пошту змінює лише адміністратор, роль не змінює ніхто через Data API.
// PGlite застосовує наші міграції й сид; кожен тест відмови перевіряє і відмову, і те, що дані не змінились.
import { afterAll, beforeAll, expect, it } from "vitest";
import { createLeaveDb, type LeaveDb } from "./supabase-pglite";

let t: LeaveDb;

beforeAll(async () => {
  t = await createLeaveDb();
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

const user = (email: string) => t.users[`${email}@example.test`];

const profileOf = async (email: string) =>
  (
    await t.asService<{ full_name: string; role: string }>("select full_name, role from public.profiles where id = $1", [
      user(email),
    ])
  )[0];

for (const email of ["teacher1", "manager1", "admin"]) {
  it(`матриця PM: ${email} не змінює власне ім'я прямим запитом, ім'я лишається`, async () => {
    const before = await profileOf(email);

    await expect(
      t.asUser(user(email), "update public.profiles set full_name = 'Нове ім''я' where id = $1", [user(email)]),
    ).rejects.toThrow(/permission denied/);

    expect(await profileOf(email)).toEqual(before);
  });
}

it("матриця PM: працівник не підвищує собі роль прямим запитом, роль лишається", async () => {
  const before = await profileOf("teacher1");

  await expect(
    t.asUser(user("teacher1"), "update public.profiles set role = 'admin' where id = $1", [user("teacher1")]),
  ).rejects.toThrow(/permission denied/);

  expect(await profileOf("teacher1")).toEqual(before);
});

it("матриця PM: користувач і далі читає власний профіль", async () => {
  const rows = await t.asUser<{ id: string }>(user("teacher1"), "select id from public.profiles");

  expect(rows.map((row) => row.id)).toContain(user("teacher1"));
});
