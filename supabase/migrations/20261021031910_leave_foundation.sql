-- Основа зрізу «заявки на відпустку» (вимога 01, AC-LEAVE-01…20): ролі, посади, розклад, заявки й записи.
-- Рішення — у docs/decisions/0001-model-leave-entries.md і openspec/changes/impl-leave-management/design.md.
--
-- Правила міграції проєкту (AGENTS.md → «База даних»): кожна таблиця в public — enable row level security;
-- revoke all from anon, authenticated, потім явні GRANT; окрема політика на кожну операцію, `to authenticated`;
-- auth.uid() у політиках — лише як (select auth.uid()); security definer — лише у схемі private з set search_path = ''.
-- Час: цивільна дата й локальний час (Europe/Kyiv) без перерахунку поясів.

-- ── 1. Ролі: member/admin → employee/manager/admin ──────────────────────────
-- Порядок важливий (див. заголовок стартової міграції): знімаємо старий constraint, оновлюємо дані,
-- ставимо новий default, і лише тоді новий constraint. Інакше UPDATE або тригер on_auth_user_created впаде (23514).
alter table public.profiles drop constraint profiles_role_check;
update public.profiles set role = 'employee' where role = 'member';
alter table public.profiles alter column role set default 'employee';
alter table public.profiles
  add constraint profiles_role_check check (role in ('employee', 'manager', 'admin'));

-- ── 2. Таблиці ──────────────────────────────────────────────────────────────
-- Посада працівника: основна (рівно одна) або додаткова; підрозділ — підпис, окремої таблиці немає (WS10).
create table public.positions (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('main', 'additional')),
  division    text not null,
  job_title   text not null,
  created_at  timestamptz not null default now()
);

create unique index positions_one_main_per_employee on public.positions (employee_id) where kind = 'main';
create index positions_employee_id_idx on public.positions (employee_id);

-- Відповідальні менеджери посади (кількох може бути).
create table public.position_managers (
  position_id uuid not null references public.positions (id) on delete cascade,
  manager_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (position_id, manager_id)
);

create index position_managers_manager_id_idx on public.position_managers (manager_id);

-- Блок розкладу: день тижня 1 (пн) … 7 (нд); блок включає початок і не включає кінець; кроки по 5 хвилин.
create table public.schedule_blocks (
  id          uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.positions (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),
  starts_at   time not null,
  ends_at     time not null,
  constraint schedule_blocks_order check (ends_at > starts_at),
  constraint schedule_blocks_step check (
    extract(epoch from starts_at)::int % 300 = 0 and extract(epoch from ends_at)::int % 300 = 0
  )
);

create index schedule_blocks_position_weekday_idx on public.schedule_blocks (position_id, weekday);

-- Заявка: один тип відпустки на заявку; необов'язковий коментар до 500 символів; спорідненість лише для "family".
create table public.leave_requests (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.profiles (id) on delete cascade,
  leave_type   text not null check (leave_type in ('sick', 'personal', 'unpaid', 'family')),
  relationship text check (relationship in ('sibling', 'child', 'parent', 'grandchild', 'grandparent')),
  comment      text check (comment is null or char_length(comment) <= 500),
  created_at   timestamptz not null default now(),
  constraint leave_requests_family_needs_relationship check (leave_type <> 'family' or relationship is not null)
);

create index leave_requests_employee_id_idx on public.leave_requests (employee_id);

-- Запис відпустки: одна посада, одна дата, конкретні години. employee_id дублює власника заявки,
-- щоб політики RLS не робили join на кожен запит. Ключі статусів — англійські, як у глосарії PM.
create table public.leave_records (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.leave_requests (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  position_id uuid not null references public.positions (id),
  leave_date  date not null,
  starts_at   time not null,
  ends_at     time not null,
  status      text not null default 'awaiting_decision'
    check (status in ('awaiting_decision', 'approved', 'rejected', 'returned_for_revision', 'cancelled')),
  created_at  timestamptz not null default now(),
  constraint leave_records_order check (ends_at > starts_at)
);

create index leave_records_employee_date_idx on public.leave_records (employee_id, leave_date);
create index leave_records_request_id_idx on public.leave_records (request_id);
create index leave_records_position_date_idx on public.leave_records (position_id, leave_date);

comment on table public.leave_records is
  'Запис відпустки: одна посада, одна дата, години. Рішення менеджера й баланс — окремі зрізи (вимоги 02 і 03).';

alter table public.positions enable row level security;
alter table public.position_managers enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_records enable row level security;

-- ── 3. Права (GRANT) ────────────────────────────────────────────────────────
revoke all on table public.positions, public.position_managers, public.schedule_blocks,
  public.leave_requests, public.leave_records from anon, authenticated;

-- Посади, менеджерів і розклад адміністратор веде в зрізі WS10; поки що їх лише читають.
grant select on table public.positions, public.position_managers, public.schedule_blocks to authenticated;
-- Заявки й записи працівник створює й читає; змінювати й видаляти (рішення менеджера) — наступні зрізи.
grant select, insert on table public.leave_requests, public.leave_records to authenticated;

grant select, insert, update, delete on table public.positions, public.position_managers,
  public.schedule_blocks, public.leave_requests, public.leave_records to service_role;

-- ── 4. Хелпери політик (схема private: Data API її не бачить) ───────────────
-- security definer читає таблиці в обхід RLS, тож політики не зациклюються (42P17).
create or replace function private.owns_position(p_position_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.positions as p
    where p.id = p_position_id and p.employee_id = (select auth.uid())
  );
$$;

create or replace function private.manages_position(p_position_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.position_managers as m
    where m.position_id = p_position_id and m.manager_id = (select auth.uid())
  );
$$;

revoke execute on function private.owns_position(uuid), private.manages_position(uuid) from public, anon;
grant execute on function private.owns_position(uuid), private.manages_position(uuid) to authenticated;

-- ── 5. Політики RLS (окремо на кожну операцію, `to authenticated`) ─────────
create policy positions_select
  on public.positions
  for select
  to authenticated
  using (
    employee_id = (select auth.uid())
    or private.manages_position(id)
    or (select private.current_app_role()) = 'admin'
  );

create policy position_managers_select
  on public.position_managers
  for select
  to authenticated
  using (
    manager_id = (select auth.uid())
    or private.owns_position(position_id)
    or (select private.current_app_role()) = 'admin'
  );

create policy schedule_blocks_select
  on public.schedule_blocks
  for select
  to authenticated
  using (
    private.owns_position(position_id)
    or private.manages_position(position_id)
    or (select private.current_app_role()) = 'admin'
  );

create policy leave_requests_select
  on public.leave_requests
  for select
  to authenticated
  using (
    employee_id = (select auth.uid())
    or (select private.current_app_role()) = 'admin'
  );

create policy leave_requests_insert
  on public.leave_requests
  for insert
  to authenticated
  with check (employee_id = (select auth.uid()));

create policy leave_records_select
  on public.leave_records
  for select
  to authenticated
  using (
    employee_id = (select auth.uid())
    or (select private.current_app_role()) = 'admin'
  );

-- Працівник створює лише власні записи на власних посадах і лише у статусі «Awaiting decision».
create policy leave_records_insert
  on public.leave_records
  for insert
  to authenticated
  with check (
    employee_id = (select auth.uid())
    and status = 'awaiting_decision'
    and private.owns_position(position_id)
  );

-- ── 6. Атомарне створення заявки ────────────────────────────────────────────
-- У supabase-js немає транзакцій: заявка й усі її записи створюються однією функцією (одна транзакція),
-- яку застосунок викликає через supabase.rpc(). security invoker: політики RLS діють і для неї.
-- p_records — масив {position_id, leave_date, starts_at, ends_at}; правила (години, розклад, перетини)
-- перевіряє застосунок до виклику, а база страхує обмеженнями й RLS.
create or replace function public.create_leave_request(
  p_leave_type text,
  p_records jsonb,
  p_relationship text default null,
  p_comment text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) = 0 then
    raise exception 'p_records must be a non-empty array' using errcode = '22023';
  end if;

  insert into public.leave_requests (employee_id, leave_type, relationship, comment)
  values (v_uid, p_leave_type, p_relationship, p_comment)
  returning id into v_request_id;

  insert into public.leave_records (request_id, employee_id, position_id, leave_date, starts_at, ends_at)
  select
    v_request_id,
    v_uid,
    (r ->> 'position_id')::uuid,
    (r ->> 'leave_date')::date,
    (r ->> 'starts_at')::time,
    (r ->> 'ends_at')::time
  from jsonb_array_elements(p_records) as r;

  return v_request_id;
end;
$$;

revoke execute on function public.create_leave_request(text, jsonb, text, text) from public, anon;
grant execute on function public.create_leave_request(text, jsonb, text, text) to authenticated;
