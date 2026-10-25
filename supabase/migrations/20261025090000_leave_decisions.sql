-- Рішення менеджера щодо записів відпустки (вимога 02, AC-DECIDE-01…24).
-- Рішення — openspec/changes/impl-leave-decision/design.md (D1–D5) і docs/decisions/0004-decision-functions.md.
--
-- Правила міграції проєкту (AGENTS.md → «База даних»): кожна таблиця в public — enable row level security;
-- revoke all from anon, authenticated, потім явні GRANT; окрема політика на кожну операцію, `to authenticated`;
-- auth.uid() у політиках — лише як (select auth.uid()); security definer — лише у схемі private з set search_path = ''.
--
-- Головне правило цієї міграції: `leave_records` і `leave_requests` для `authenticated` НЕ мають grant update.
-- Статус, години, власник і посада змінюються лише функціями нижче, які першим кроком перевіряють роль і право.

-- ── 1. Журнал рішень ────────────────────────────────────────────────────────
-- Один запис може мати кілька рішень (повернули → виправили → схвалили): історія — це всі рядки.
-- decided_at зберігаємо з точністю до хвилини (припущення PM). Рядок додає лише функція decide_leave_record.
create table public.leave_decisions (
  id         uuid primary key default gen_random_uuid(),
  record_id  uuid not null references public.leave_records (id) on delete cascade,
  decided_by uuid not null references public.profiles (id),
  decision   text not null check (decision in ('approved', 'rejected', 'returned_for_revision')),
  comment    text,
  decided_at timestamptz not null default date_trunc('minute', now()),
  constraint leave_decisions_return_needs_comment
    check (decision <> 'returned_for_revision' or (comment is not null and btrim(comment) <> ''))
);

create index leave_decisions_record_id_idx on public.leave_decisions (record_id, decided_at);

comment on table public.leave_decisions is
  'Журнал рішень менеджера: хто, коли й що вирішив щодо запису відпустки (AC-DECIDE-10, AC-DECIDE-15).';

alter table public.leave_decisions enable row level security;

revoke all on table public.leave_decisions from anon, authenticated;
-- Читати журнал можна (під політикою нижче); insert/update/delete для authenticated немає: рядок додає лише функція.
grant select on table public.leave_decisions to authenticated;
grant select, insert, update, delete on table public.leave_decisions to service_role;

-- ── 2. Хелпери політик (схема private: Data API її не бачить) ───────────────
create or replace function private.manages_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leave_records as r
    join public.position_managers as m on m.position_id = r.position_id
    where r.request_id = p_request_id and m.manager_id = (select auth.uid())
  );
$$;

create or replace function private.manages_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.positions as p
    join public.position_managers as m on m.position_id = p.id
    where p.employee_id = p_employee_id and m.manager_id = (select auth.uid())
  );
$$;

create or replace function private.can_see_record(p_record_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leave_records as r
    where r.id = p_record_id
      and (
        r.employee_id = (select auth.uid())
        or exists (
          select 1 from public.position_managers as m
          where m.position_id = r.position_id and m.manager_id = (select auth.uid())
        )
        or (select private.current_app_role()) = 'admin'
      )
  );
$$;

-- Автор рішення: профіль того, хто вирішив запис, бачать лише ті, хто бачить сам запис (AC-DECIDE-15: «хто вирішив»).
-- Загального доступу до профілів це не дає: профіль автора видно тільки через рішення, доступне користувачу.
create or replace function private.sees_decider(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leave_decisions as d
    where d.decided_by = p_profile_id and private.can_see_record(d.record_id)
  );
$$;

revoke execute on function private.manages_request(uuid), private.manages_employee(uuid), private.can_see_record(uuid),
  private.sees_decider(uuid) from public, anon;
grant execute on function private.manages_request(uuid), private.manages_employee(uuid), private.can_see_record(uuid),
  private.sees_decider(uuid) to authenticated;

-- ── 3. Політики читання: менеджер бачить записи лише своїх посад (AC-DECIDE-01, AC-DECIDE-08) ──
drop policy leave_records_select on public.leave_records;
create policy leave_records_select
  on public.leave_records
  for select
  to authenticated
  using (
    employee_id = (select auth.uid())
    or private.manages_position(position_id)
    or (select private.current_app_role()) = 'admin'
  );

-- Тип відпустки й коментар працівника бачить менеджер посади хоча б одного запису заявки (AC-DECIDE-20).
drop policy leave_requests_select on public.leave_requests;
create policy leave_requests_select
  on public.leave_requests
  for select
  to authenticated
  using (
    employee_id = (select auth.uid())
    or private.manages_request(id)
    or (select private.current_app_role()) = 'admin'
  );

-- Менеджер бачить профіль працівника своєї посади (ім'я в списку рішень), а працівник і менеджер посади — профіль автора
-- рішення за записом, який вони бачать. Змінювати чужий профіль не можна нікому.
drop policy profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.manages_employee(id)
    or private.sees_decider(id)
    or (select private.current_app_role()) = 'admin'
  );

create policy leave_decisions_select
  on public.leave_decisions
  for select
  to authenticated
  using (private.can_see_record(record_id));

-- ── 4. Функції: рішення, зміна годин, скасування ────────────────────────────
-- Відповідь — jsonb {"ok": true|false, "status": "<поточний статус>"}: «запис уже вирішено» — не помилка прав, а
-- звичайна відповідь (AC-DECIDE-07, AC-DECIDE-12). Порушення прав — виняток 42501 із текстом:
--   forbidden   — немає ролі, запису не видно чи менеджер не відповідає за посаду (AC-DECIDE-08, AC-DECIDE-09);
--   own_record  — менеджер вирішує власний запис, це може лише адміністратор (AC-DECIDE-18, AC-DECIDE-19).

create or replace function private.decide_leave_record(p_record_id uuid, p_decision text, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_record public.leave_records%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected', 'returned_for_revision') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;

  v_role := private.current_app_role();
  if v_role is null or v_role not in ('manager', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Рядок блокуємо: два одночасні рішення не пройдуть обидва (AC-DECIDE-07).
  select * into v_record from public.leave_records where id = p_record_id for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_role <> 'admin' then
    if not exists (
      select 1 from public.position_managers as m
      where m.position_id = v_record.position_id and m.manager_id = v_uid
    ) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_record.employee_id = v_uid then
      raise exception 'own_record' using errcode = '42501';
    end if;
  end if;

  if v_record.status <> 'awaiting_decision' then
    return jsonb_build_object('ok', false, 'status', v_record.status);
  end if;

  if p_decision = 'returned_for_revision' and (p_comment is null or btrim(p_comment) = '') then
    raise exception 'comment_required' using errcode = '22023';
  end if;

  update public.leave_records set status = p_decision where id = p_record_id;
  insert into public.leave_decisions (record_id, decided_by, decision, comment)
  values (p_record_id, v_uid, p_decision, nullif(btrim(p_comment), ''));

  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$$;

-- Працівник змінює лише години власного запису (AC-DECIDE-16, AC-DECIDE-21). Зі статусу «Returned for revision»
-- запис повертається в «Awaiting decision» (повторне подання, AC-DECIDE-06). Перетин із іншими записами тієї ж
-- посади відхиляє обмеження leave_records_no_overlap (23P01); сам із собою запис не перетинається.
create or replace function private.update_leave_record_hours(p_record_id uuid, p_starts_at time, p_ends_at time)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_record public.leave_records%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'invalid hours' using errcode = '22023';
  end if;

  select * into v_record from public.leave_records where id = p_record_id for update;
  if not found or v_record.employee_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_record.status not in ('awaiting_decision', 'returned_for_revision') then
    return jsonb_build_object('ok', false, 'status', v_record.status);
  end if;

  update public.leave_records
  set starts_at = p_starts_at, ends_at = p_ends_at, status = 'awaiting_decision'
  where id = p_record_id;

  return jsonb_build_object('ok', true, 'status', 'awaiting_decision');
end;
$$;

-- Працівник скасовує лише власний запис зі статусом «Awaiting decision» чи «Returned for revision» (AC-DECIDE-13,
-- AC-DECIDE-17). «Cancelled» кінцевий: з нього запис нікуди не переходить.
create or replace function private.cancel_leave_record(p_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_record public.leave_records%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_record from public.leave_records where id = p_record_id for update;
  if not found or v_record.employee_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_record.status not in ('awaiting_decision', 'returned_for_revision') then
    return jsonb_build_object('ok', false, 'status', v_record.status);
  end if;

  update public.leave_records set status = 'cancelled' where id = p_record_id;
  return jsonb_build_object('ok', true, 'status', 'cancelled');
end;
$$;

revoke execute on function
  private.decide_leave_record(uuid, text, text),
  private.update_leave_record_hours(uuid, time, time),
  private.cancel_leave_record(uuid)
  from public, anon;
grant execute on function
  private.decide_leave_record(uuid, text, text),
  private.update_leave_record_hours(uuid, time, time),
  private.cancel_leave_record(uuid)
  to authenticated;

-- ── 5. Обгортки для застосунку (security invoker, Data API бачить лише public) ──
create or replace function public.decide_leave_record(p_record_id uuid, p_decision text, p_comment text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.decide_leave_record(p_record_id, p_decision, p_comment);
$$;

create or replace function public.update_leave_record_hours(p_record_id uuid, p_starts_at time, p_ends_at time)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_leave_record_hours(p_record_id, p_starts_at, p_ends_at);
$$;

create or replace function public.cancel_leave_record(p_record_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_leave_record(p_record_id);
$$;

revoke execute on function
  public.decide_leave_record(uuid, text, text),
  public.update_leave_record_hours(uuid, time, time),
  public.cancel_leave_record(uuid)
  from public, anon;
grant execute on function
  public.decide_leave_record(uuid, text, text),
  public.update_leave_record_hours(uuid, time, time),
  public.cancel_leave_record(uuid)
  to authenticated;
