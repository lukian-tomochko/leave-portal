// Тестова база: справжній Postgres у WASM (PGlite) з емульованими ролями Supabase.
// Взято з демо-репо курсу і адаптовано під наш проєкт (без підрозділів демо; сид застосовується після користувачів):
// https://github.com/koldovsky/2026-quitcode-06-leave-portal-demo/blob/48337f0d64bb65498fc40de53156857796633fed/tests/db/supabase-pglite.ts
// Застосовує ті самі supabase/migrations/*.sql і supabase/seed.sql, що й job db-deploy у CI, без Docker.
// Межа емуляції: Auth, PostgREST і JWT — спрощені (auth.uid() читає request.jwt.claim.sub).
// Налаштування хмарного проєкту (Confirm email, реєстрація, Redirect URLs) тут не перевіряються.
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

interface DemoUser {
  email: string;
  full_name: string;
  role: "employee" | "manager" | "admin";
}

/** Емуляція того, що в Supabase вже є до наших міграцій: ролі, схема auth, auth.uid(). */
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create role supabase_auth_admin nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant select, insert, delete on auth.users to supabase_auth_admin;
  grant usage on schema public to anon, authenticated, service_role;
  create schema if not exists extensions;
`;

export interface LeaveDb {
  db: PGlite;
  /** id користувачів за email із supabase/demo-users.json. */
  users: Record<string, string>;
  /** SQL від імені користувача (role authenticated, auth.uid() = id) в окремій транзакції. */
  asUser<T = Record<string, unknown>>(userId: string, sql: string, params?: unknown[]): Promise<T[]>;
  /** SQL від імені відвідувача без входу (role anon, auth.uid() = null). */
  asAnon<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** SQL в обхід RLS (як Dashboard / service_role) — для підготовки даних і перевірки результату. */
  asService<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

// Роль, claim і SQL виконуються в одній транзакції PGlite (db.transaction): помилка відкочує її, а COMMIT теж може
// впасти (відкладені constraint trigger-и), і тоді помилка потрапляє до тесту.
async function inTransaction<T>(db: PGlite, role: string, userId: string | null, sql: string, params: unknown[]) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    if (userId) await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await tx.query<T>(sql, params);
    return result.rows;
  });
}

export async function createLeaveDb(): Promise<LeaveDb> {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(SUPABASE_SHIM);
  const migrations = readdirSync(new URL("supabase/migrations/", root))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations) await db.exec(read(`supabase/migrations/${file}`));

  // Як scripts/create-demo-users.mjs: користувач Auth → тригер створює профіль → service_role ставить роль.
  const demoUsers = JSON.parse(read("supabase/demo-users.json")) as DemoUser[];
  const users: Record<string, string> = {};
  for (const [i, u] of demoUsers.entries()) {
    users[u.email] = `a0000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`;
  }
  await db.exec("begin; set local role supabase_auth_admin;");
  for (const u of demoUsers) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      users[u.email],
      u.email,
      { full_name: u.full_name },
    ]);
  }
  await db.exec("commit; begin; set local role service_role;");
  for (const u of demoUsers) {
    await db.query("update public.profiles set role = $2 where id = $1", [users[u.email], u.role]);
  }
  await db.exec("commit");

  // Сид нашого проєкту додає посади, менеджерів і розклад лише для наявних профілів, тож застосовуємо його
  // після користувачів.
  await db.exec(read("supabase/seed.sql"));

  return {
    db,
    users,
    asUser: <T,>(userId: string, sql: string, params: unknown[] = []) =>
      inTransaction<T>(db, "authenticated", userId, sql, params),
    asAnon: <T,>(sql: string, params: unknown[] = []) => inTransaction<T>(db, "anon", null, sql, params),
    asService: <T,>(sql: string, params: unknown[] = []) => inTransaction<T>(db, "service_role", null, sql, params),
  };
}
