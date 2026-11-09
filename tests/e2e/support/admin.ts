// Синтетичні дані UAT і прибирання за ними — секретним ключем Supabase (обходить RLS).
// Лише в тестах і лише на машині розробника (.env.local) або в CI на одноразовому локальному стеку (e2e.yml).
// У GitHub Secrets SUPABASE_SECRET_KEY не додаємо. Без ключа (прогін лише AC, що нічого не пишуть,
// --grep-invert '@writes') цей файл нічого не робить: cleanup.teardown.ts не реєструє тест.
// check:boundary сканує src/, тож цей файл його не порушує; у src/ секретний ключ читає лише src/lib/supabase/admin.ts.
// Ніколи не друкуємо значення ключів і паролів — лише адреси синтетичних користувачів.
//
// Джерело: демо-репо курсу, tests/e2e/support/admin.ts (тег ws8-03-uat). Демо-специфічні помічники (createEmployee
// з підрозділом і посадою, isBlockedDay, leaveRequestsOf) прибрано — подивіться їх у демо як зразок для своїх.
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ВАШЕ: рядки синтетичного користувача, які треба видалити ДО deleteUser, — таблиці з FK на користувача без
 * on delete cascade (інакше Auth відповідає «Database error deleting user»). У демо: leave_requests.employee_id.
 * Якщо таких таблиць немає (або всі FK — cascade), лишіть порожнім.
 */
const OWNED_ROWS: { table: string; column: string }[] = [{ table: "leave_requests", column: "employee_id" }];

/** Лише такі адреси прибирання має право видалити: uat-<run>[-<суфікс>]@example.test. */
export const UAT_EMAIL = /^uat-[0-9a-z-]+@example\.test$/;

export function uatEmail(suffix?: string): string {
  const run = process.env.UAT_RUN ?? "manual";
  const email = `uat-${run}${suffix ? `-${suffix}` : ""}@example.test`;
  if (!UAT_EMAIL.test(email)) throw new Error(`Синтетична адреса має вигляд uat-…@example.test, а не ${email}`);
  return email;
}

export const randomPassword = () => `Uat-${randomBytes(12).toString("base64url")}`;

export function hasAdminKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/** Клієнт із секретним ключем — для ваших помічників синтетичних даних (створити користувача, прочитати рядок). */
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("Для синтетичних даних UAT потрібні NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SECRET_KEY (.env.local)");
  }
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function listUatUsers(supabase: SupabaseClient): Promise<{ id: string; email: string }[]> {
  const found: { id: string; email: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.email && UAT_EMAIL.test(u.email)) found.push({ id: u.id, email: u.email });
    if (data.users.length < 1000) return found;
  }
}

const CLEANUP_LOG = "test-results/uat-cleanup.jsonl";

/** Усі uat-адреси, які видалив цей прогін (за журналом). */
export function deletedThisRun(): string[] {
  if (!existsSync(CLEANUP_LOG)) return [];
  const entries = readFileSync(CLEANUP_LOG, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { deleted: string[] });
  return [...new Set(entries.flatMap((e) => e.deleted))];
}

/** leftoverRequests — скільки рядків видалених користувачів лишилось у таблицях OWNED_ROWS (назва поля — з демо). */
export type CleanupResult = { deleted: string[]; remaining: string[]; leftoverRequests: number };

/**
 * Видаляє ВСІХ uat-*@example.test (і тих, що лишились після обірваних прогонів), а потім перевіряє:
 * жодного такого користувача й жодного їхнього рядка в OWNED_ROWS.
 */
export async function deleteUatUsers(onlyEmail?: string): Promise<CleanupResult> {
  const supabase = adminClient();
  const targets = (await listUatUsers(supabase)).filter((u) => !onlyEmail || u.email === onlyEmail);
  const deleted: string[] = [];
  for (const u of targets) {
    for (const { table, column } of OWNED_ROWS) {
      const { error: rowsError } = await supabase.from(table).delete().eq(column, u.id);
      if (rowsError) throw rowsError;
    }
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) throw error;
    deleted.push(u.email);
  }
  const remaining = (await listUatUsers(supabase))
    .filter((u) => !onlyEmail || u.email === onlyEmail)
    .map((u) => u.email);
  let leftoverRequests = 0;
  for (const { table, column } of targets.length ? OWNED_ROWS : []) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .in(
        column,
        targets.map((u) => u.id),
      );
    if (error) throw error;
    leftoverRequests += count ?? 0;
  }
  // Журнал прибирань прогону: afterAll специфікацій і teardown (Playwright чистить test-results/ на старті прогону).
  mkdirSync("test-results", { recursive: true });
  appendFileSync(
    CLEANUP_LOG,
    `${JSON.stringify({ at: new Date().toISOString(), scope: onlyEmail ?? "uat-*", deleted, remaining, leftoverRequests })}\n`,
  );
  return { deleted, remaining, leftoverRequests };
}

// ── Синтетичні дані шкільного календаря (WS9) ───────────────────────────────────────────────────────────────
export type ScheduleBlock = { weekday: number; startsAt: string; endsAt: string };

/** Позиції сиду (supabase/seed.sql): основна посада teacher1 — пн–пт 08:30–15:30. */
export const POSITION_T1_MAIN = "00000000-0000-4000-8000-000000000101";

async function profileIdOf(supabase: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await supabase.from("profiles").select("id").eq("email", email).single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Синтетичний працівник uat-<run>-<суфікс>@example.test з однією основною посадою, розкладом і відповідальним менеджером.
 * Його видаляє прибирання (deleteUatUsers): посади, заявки й записи йдуть каскадом. Пароль — випадковий, лише в пам'яті.
 */
export async function createSyntheticEmployee(
  suffix: string,
  blocks: ScheduleBlock[],
  managerEmail = "manager1@example.test",
): Promise<{ id: string; email: string; password: string; positionId: string }> {
  const supabase = adminClient();
  const email = uatEmail(suffix);
  const password = randomPassword();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `UAT ${suffix}` },
  });
  if (error) throw error;
  const id = data.user.id;
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id, email, full_name: `UAT ${suffix}`, role: "employee" }, { onConflict: "id" });
  if (profileError) throw profileError;
  const { data: position, error: positionError } = await supabase
    .from("positions")
    .insert({ employee_id: id, kind: "main", division: "Elementary school", job_title: "Teacher" })
    .select("id")
    .single();
  if (positionError) throw positionError;
  const positionId = position.id as string;
  const { error: blocksError } = await supabase
    .from("schedule_blocks")
    .insert(blocks.map((b) => ({ position_id: positionId, weekday: b.weekday, starts_at: b.startsAt, ends_at: b.endsAt })));
  if (blocksError) throw blocksError;
  const { error: managerError } = await supabase
    .from("position_managers")
    .insert({ position_id: positionId, manager_id: await profileIdOf(supabase, managerEmail) });
  if (managerError) throw managerError;
  return { id, email, password, positionId };
}

export type SeedRecord = {
  employeeEmail: string;
  positionId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  status: "awaiting_decision" | "approved" | "rejected";
  leaveType?: "sick" | "personal";
};

/** Запис відпустки з потрібним статусом (Given). Коментар uat-<run> позначає його для прибирання deleteSeededRecords. */
export async function seedRecord(input: SeedRecord): Promise<{ requestId: string; recordId: string; employeeId: string }> {
  const supabase = adminClient();
  const employeeId = await profileIdOf(supabase, input.employeeEmail);
  const { data: request, error } = await supabase
    .from("leave_requests")
    .insert({ employee_id: employeeId, leave_type: input.leaveType ?? "personal", comment: `uat-${process.env.UAT_RUN ?? "manual"}` })
    .select("id")
    .single();
  if (error) throw error;
  const { data: record, error: recordError } = await supabase
    .from("leave_records")
    .insert({
      request_id: request.id,
      employee_id: employeeId,
      position_id: input.positionId,
      leave_date: input.date,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      status: input.status,
    })
    .select("id")
    .single();
  if (recordError) throw recordError;
  return { requestId: request.id as string, recordId: record.id as string, employeeId };
}

/** Видаляє всі засіяні заявки (коментар uat-…) разом із записами; повертає, скільки лишилось. */
export async function deleteSeededRecords(): Promise<number> {
  const supabase = adminClient();
  const { error } = await supabase.from("leave_requests").delete().like("comment", "uat-%");
  if (error) throw error;
  const { count, error: countError } = await supabase
    .from("leave_requests")
    .select("*", { count: "exact", head: true })
    .like("comment", "uat-%");
  if (countError) throw countError;
  return count ?? 0;
}
