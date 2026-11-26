-- Частка дня погодженого запису фіксується при погодженні (AC-CAL-20, ADR 0012).
-- Баланс раніше рахувався лише від поточного календаря: пізніше закриття змінювало знаменник (робочі хвилини дати) і
-- «Sick leave» 0.36 ставав 0.71. Тепер при погодженні застосунок передає два числа, а база їх зберігає:
--   counted_minutes — скільки хвилин запису порахувалось (лише незакриті блоки на момент погодження);
--   day_minutes     — скільки незакритих робочих хвилин мала дата на момент погодження (за всіма посадами працівника).
-- Старі погоджені записи лишаються з null: для них баланс рахується за поточним календарем, як і було.
-- Деструктивних змін немає: лише нові nullable-колонки й нова версія двох функцій (старі параметри збережено).

-- ── 1. Колонки й межі ────────────────────────────────────────────────────────
alter table public.leave_records
  add column counted_minutes integer,
  add column day_minutes integer;

-- Обидва числа або задані разом, або обидва порожні.
alter table public.leave_records
  add constraint leave_records_day_share_pair check ((counted_minutes is null) = (day_minutes is null));

-- 1…1440 хвилин у добі; порахованих хвилин не більше, ніж робочих на дату.
alter table public.leave_records
  add constraint leave_records_day_share_bounds check (
    day_minutes is null or (day_minutes between 1 and 1440 and counted_minutes between 0 and day_minutes)
  );

-- ── 2. Вхідні дані балансу: додано знімок частки ─────────────────────────────
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
        'unpaid_share', r.unpaid_share,
        'counted_minutes', r.counted_minutes,
        'day_minutes', r.day_minutes
      ))
      from public.leave_records as r
      join public.leave_requests as q on q.id = r.request_id
      where r.employee_id = p_employee_id and r.status = 'approved'
    ), '[]'::jsonb)
  );
end;
$$;

-- ── 3. Рішення зі знімком частки ─────────────────────────────────────────────
-- Нова версія з двома додатковими необов'язковими параметрами замінює стару з п'ятьма. Усі перевірки прав і порядок
-- блокувань — як у 20261027090000_leave_balance.sql. Самі числа знімка визначає застосунок (як і суму розподілу, ADR
-- 0005); база перевіряє межі й те, що знімок можливий лише при схваленні.
drop function public.decide_leave_record(uuid, text, text, numeric, numeric);
drop function private.decide_leave_record(uuid, text, text, numeric, numeric);

create function private.decide_leave_record(
  p_record_id uuid,
  p_decision text,
  p_comment text default null,
  p_paid_share numeric default null,
  p_unpaid_share numeric default 0,
  p_counted_minutes integer default null,
  p_day_minutes integer default null
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
  -- Знімок частки дня (AC-CAL-20): обидва числа разом, лише при схваленні, у межах доби.
  if (p_counted_minutes is null) <> (p_day_minutes is null)
    or (
      p_counted_minutes is not null
      and (
        p_decision <> 'approved'
        or p_day_minutes < 1 or p_day_minutes > 1440
        or p_counted_minutes < 0 or p_counted_minutes > p_day_minutes
      )
    ) then
    raise exception 'invalid snapshot' using errcode = '22023';
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
      unpaid_share = case when p_decision = 'approved' then coalesce(p_unpaid_share, 0) else 0 end,
      counted_minutes = case when p_decision = 'approved' then p_counted_minutes end,
      day_minutes = case when p_decision = 'approved' then p_day_minutes end
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
  p_unpaid_share numeric default 0,
  p_counted_minutes integer default null,
  p_day_minutes integer default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.decide_leave_record(
    p_record_id, p_decision, p_comment, p_paid_share, p_unpaid_share, p_counted_minutes, p_day_minutes
  );
$$;

revoke execute on function
  private.decide_leave_record(uuid, text, text, numeric, numeric, integer, integer),
  public.decide_leave_record(uuid, text, text, numeric, numeric, integer, integer)
  from public, anon;
grant execute on function
  private.decide_leave_record(uuid, text, text, numeric, numeric, integer, integer),
  public.decide_leave_record(uuid, text, text, numeric, numeric, integer, integer)
  to authenticated;
