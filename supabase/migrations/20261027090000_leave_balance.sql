-- Баланс відпусток (вимога 03, AC-BALANCE-01…22): розподіл схваленого запису на оплачувану й неоплачувану частини та
-- функція вхідних даних для розрахунку балансу з перевіркою, хто може їх бачити.
-- Рішення — openspec/changes/impl-leave-balance/design.md і docs/decisions/0005-balance-computed-in-app.md.
--
-- Баланс обчислює застосунок (чиста функція, тести без бази); база лише віддає вхідні дані тим, кому дозволено, і зберігає
-- розподіл, який менеджер ухвалив при схваленні. Права читання: працівник — свої, адміністратор — усіх, менеджер —
-- працівників, у яких є хоча б одна його посада (AC-BALANCE-12, AC-BALANCE-13, AC-BALANCE-20). Прямий доступ менеджера до
-- записів чужих посад це НЕ відкриває: функція віддає лише схвалені записи й розклади посад цього працівника.
--
-- РИЗИК: drop function (стара версія decide_leave_record із трьома параметрами замінюється версією з розподілом).
-- Застосунок викликає лише нову; права execute (revoke від public і anon, grant authenticated) задаються заново.

-- ── 1. Розподіл схваленого запису ────────────────────────────────────────────
-- paid_share і unpaid_share — частки дня (0.00–1.00): скільки з частки запису зараховано як «Personal leave» і скільки як
-- «Unpaid leave». Задаються лише при схваленні запису з розподілом (AC-BALANCE-10, AC-BALANCE-19).
alter table public.leave_records
  add column paid_share numeric(4, 2) check (paid_share is null or paid_share between 0 and 1),
  add column unpaid_share numeric(4, 2) not null default 0 check (unpaid_share between 0 and 1);

alter table public.leave_records
  add constraint leave_records_split_only_approved check (unpaid_share = 0 or status = 'approved');

-- ── 2. Вхідні дані балансу ───────────────────────────────────────────────────
create or replace function private.employee_balance_inputs(p_employee_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Працівник бачить свій баланс, адміністратор усіх, менеджер працівників своїх посад. Решті відмова без даних.
  if not (
    v_uid = p_employee_id
    or (select private.current_app_role()) = 'admin'
    or exists (
      select 1
      from public.positions as p
      join public.position_managers as m on m.position_id = p.id
      where p.employee_id = p_employee_id and m.manager_id = v_uid
    )
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'kind', p.kind,
        'division', p.division,
        'job_title', p.job_title,
        'blocks', coalesce((
          select jsonb_agg(jsonb_build_object('weekday', b.weekday, 'starts_at', b.starts_at, 'ends_at', b.ends_at))
          from public.schedule_blocks as b
          where b.position_id = p.id
        ), '[]'::jsonb)
      ))
      from public.positions as p
      where p.employee_id = p_employee_id
    ), '[]'::jsonb),
    -- Баланс зменшують лише схвалені записи (AC-BALANCE-04, AC-BALANCE-07).
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'position_id', r.position_id,
        'date', r.leave_date,
        'starts_at', r.starts_at,
        'ends_at', r.ends_at,
        'leave_type', q.leave_type,
        'paid_share', r.paid_share,
        'unpaid_share', r.unpaid_share
      ))
      from public.leave_records as r
      join public.leave_requests as q on q.id = r.request_id
      where r.employee_id = p_employee_id and r.status = 'approved'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.employee_balance_inputs(p_employee_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.employee_balance_inputs(p_employee_id);
$$;

revoke execute on function private.employee_balance_inputs(uuid), public.employee_balance_inputs(uuid) from public, anon;
grant execute on function private.employee_balance_inputs(uuid), public.employee_balance_inputs(uuid) to authenticated;

-- ── 3. Рішення з розподілом ──────────────────────────────────────────────────
-- Стара версія з трьома параметрами замінюється: розподіл потрібен лише при схваленні. Усі перевірки прав і порядок
-- блокувань лишаються як у 20261025090000_leave_decisions.sql. Саму суму розподілу (скільки неоплачуваних днів
-- потрібно) визначає застосунок за балансом; база перевіряє межі й те, що розподіл можливий лише при схваленні.
drop function public.decide_leave_record(uuid, text, text);
drop function private.decide_leave_record(uuid, text, text);

create function private.decide_leave_record(
  p_record_id uuid,
  p_decision text,
  p_comment text default null,
  p_paid_share numeric default null,
  p_unpaid_share numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_record public.leave_records%rowtype;
  v_owner uuid;
  v_position uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected', 'returned_for_revision') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  -- Розподіл можливий лише при схваленні й у межах одного дня.
  if coalesce(p_unpaid_share, 0) < 0 or coalesce(p_unpaid_share, 0) > 1
    or (p_paid_share is not null and (p_paid_share < 0 or p_paid_share > 1))
    or (p_decision <> 'approved' and (p_paid_share is not null or coalesce(p_unpaid_share, 0) <> 0)) then
    raise exception 'invalid split' using errcode = '22023';
  end if;

  v_role := private.current_app_role();
  if v_role is null or v_role not in ('manager', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Права перевіряємо ДО блокування: інакше сторонній менеджер міг би тримати блокування на чужих записах.
  select r.employee_id, r.position_id into v_owner, v_position from public.leave_records as r where r.id = p_record_id;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_role <> 'admin' then
    if not exists (
      select 1 from public.position_managers as m
      where m.position_id = v_position and m.manager_id = v_uid
    ) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_owner = v_uid then
      raise exception 'own_record' using errcode = '42501';
    end if;
  end if;

  -- Призначення менеджера фіксуємо до кінця транзакції (for share), потім блокуємо рядок запису.
  if v_role <> 'admin' then
    perform 1 from public.position_managers as m
    where m.position_id = v_position and m.manager_id = v_uid
    for share;
    if not found then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  select * into v_record from public.leave_records where id = p_record_id for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_record.status <> 'awaiting_decision' then
    return jsonb_build_object('ok', false, 'status', v_record.status);
  end if;

  if p_decision = 'returned_for_revision' and (p_comment is null or btrim(p_comment) = '') then
    raise exception 'comment_required' using errcode = '22023';
  end if;

  update public.leave_records
  set status = p_decision,
      paid_share = case when p_decision = 'approved' then p_paid_share end,
      unpaid_share = case when p_decision = 'approved' then coalesce(p_unpaid_share, 0) else 0 end
  where id = p_record_id;
  insert into public.leave_decisions (record_id, decided_by, decision, comment)
  values (p_record_id, v_uid, p_decision, nullif(btrim(p_comment), ''));

  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$$;

create function public.decide_leave_record(
  p_record_id uuid,
  p_decision text,
  p_comment text default null,
  p_paid_share numeric default null,
  p_unpaid_share numeric default 0
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.decide_leave_record(p_record_id, p_decision, p_comment, p_paid_share, p_unpaid_share);
$$;

revoke execute on function
  private.decide_leave_record(uuid, text, text, numeric, numeric),
  public.decide_leave_record(uuid, text, text, numeric, numeric)
  from public, anon;
grant execute on function
  private.decide_leave_record(uuid, text, text, numeric, numeric),
  public.decide_leave_record(uuid, text, text, numeric, numeric)
  to authenticated;
