-- Сид-дані проєкту. Застосовується:
--   локально — під час `supabase db reset` (потрібен Docker);
--   у хмарі — лише з `supabase db push --include-seed` (звичайний db push сид не виконує;
--   на проді: Actions → CI → Run workflow, гілка main, include_seed).
--
-- Правила:
--   * лише синтетичні дані, email-и тільки *@example.test;
--   * файл ІДЕМПОТЕНТНИЙ: повторний запуск нічого не дублює (фіксовані id + on conflict do nothing);
--   * користувачів Auth тут НЕ створюємо: їх створює scripts/create-demo-users.mjs (npm run users:demo)
--     за supabase/demo-users.json, а тригер on_auth_user_created додає профілі.
--     Посади й розклад нижче додаються лише для профілів, які вже існують: на одноразовій базі job
--     db-check користувачів немає, тож сид нічого не вставляє — і це нормально.
--
-- Дані повторюють приклади PM (requirements/01-leave-request.md): teacher1 має основну й додаткову посади
-- (AC-LEAVE-02), teacher2 — розклад з проміжком у вівторок (AC-LEAVE-15) і без суботи (AC-LEAVE-06).
-- Розклади посад однієї людини не перетинаються (припущення PM).
-- День тижня: 1 = понеділок … 7 = неділя.

-- ── Посади ───────────────────────────────────────────────────────────────────
insert into public.positions (id, employee_id, kind, division, job_title)
select v.id::uuid, p.id, v.kind, v.division, v.job_title
from (values
  ('00000000-0000-4000-8000-000000000101', 'teacher1@example.test', 'main',       'Elementary school', 'Teacher'),
  ('00000000-0000-4000-8000-000000000102', 'teacher1@example.test', 'additional', 'High school',       'Math teacher'),
  ('00000000-0000-4000-8000-000000000103', 'teacher2@example.test', 'main',       'Elementary school', 'Teacher')
) as v (id, email, kind, division, job_title)
join public.profiles as p on p.email = v.email
on conflict (id) do nothing;

-- ── Відповідальні менеджери ─────────────────────────────────────────────────
-- manager1 — початкова школа (основні посади teacher1 і teacher2), manager2 — старша школа (додаткова teacher1).
insert into public.position_managers (position_id, manager_id)
select v.position_id::uuid, p.id
from (values
  ('00000000-0000-4000-8000-000000000101', 'manager1@example.test'),
  ('00000000-0000-4000-8000-000000000103', 'manager1@example.test'),
  ('00000000-0000-4000-8000-000000000102', 'manager2@example.test')
) as v (position_id, email)
join public.profiles as p on p.email = v.email
join public.positions as pos on pos.id = v.position_id::uuid
on conflict (position_id, manager_id) do nothing;

-- ── Розклад ──────────────────────────────────────────────────────────────────
-- teacher1, основна: пн–пт 08:30–15:30.
-- teacher1, додаткова: пн 15:45–17:00.
-- teacher2, основна: пн, ср, чт, пт 08:30–15:30; вт 08:30–12:00 і 12:30–15:30 (проміжок 12:00–12:30).
insert into public.schedule_blocks (id, position_id, weekday, starts_at, ends_at)
select v.id::uuid, v.position_id::uuid, v.weekday, v.starts_at::time, v.ends_at::time
from (values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 1, '08:30', '15:30'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101', 2, '08:30', '15:30'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000101', 3, '08:30', '15:30'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000101', 4, '08:30', '15:30'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000101', 5, '08:30', '15:30'),
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000102', 1, '15:45', '17:00'),
  ('00000000-0000-4000-8000-000000000221', '00000000-0000-4000-8000-000000000103', 1, '08:30', '15:30'),
  ('00000000-0000-4000-8000-000000000222', '00000000-0000-4000-8000-000000000103', 2, '08:30', '12:00'),
  ('00000000-0000-4000-8000-000000000223', '00000000-0000-4000-8000-000000000103', 2, '12:30', '15:30'),
  ('00000000-0000-4000-8000-000000000224', '00000000-0000-4000-8000-000000000103', 3, '08:30', '15:30'),
  ('00000000-0000-4000-8000-000000000225', '00000000-0000-4000-8000-000000000103', 4, '08:30', '15:30'),
  ('00000000-0000-4000-8000-000000000226', '00000000-0000-4000-8000-000000000103', 5, '08:30', '15:30')
) as v (id, position_id, weekday, starts_at, ends_at)
join public.positions as pos on pos.id = v.position_id::uuid
on conflict (id) do nothing;
