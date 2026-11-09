-- Шкільний календар: закриття днів і годин (вимога 04: AC-CAL-01, 02, 07, 08, 09, 10, 11, 13).
--
-- Закриття — іменований період, коли школа закрита: цілі дні (від дати до дати включно) або скорочений день (одна дата й
-- час, з якого школа закрита). Читати календар може кожен авторизований користувач; змінювати його може лише
-- адміністратор, і лише функціями нижче: жодних insert/update/delete для authenticated (AC-CAL-13: пряма спроба в обхід
-- сторінок нічого не змінює). Ця міграція — лише база й права; закриття в заявці й балансі — наступні міграції й задачі.
--
-- Бізнес-відмови функції повертають jsonb {ok:false, code, …} без текстів (тексти повідомлень лежать у застосунку),
-- а доступ — винятком 42501 'forbidden'. Порядок перевірок (рішення розробника, PM порядок не задав): назва, кінець не
-- раніше початку, час скороченого дня, перетин із закриттями, записи відпустки, що блокують закриття.
--
-- РИЗИК: нова таблиця й дві нові функції, наявні дані не змінюються. Відкат — нова міграція з drop (таблиця порожня,
-- доки адміністратор нічого не додав).

create table public.school_closures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  -- NULL — закриття цілих днів; інакше скорочений день: одна дата й час закриття (крок 5 хвилин).
  closed_from time,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint school_closures_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint school_closures_dates_order check (ends_on >= starts_on),
  constraint school_closures_early_dismissal check (
    closed_from is null
    or (
      starts_on = ends_on
      and closed_from > time '00:00'
      and extract(second from closed_from) = 0
      and mod(extract(minute from closed_from)::int, 5) = 0
    )
  ),
  -- Два закриття не можуть мати спільної дати (AC-CAL-11); страхує від гонки двох одночасних додавань.
  constraint school_closures_no_overlap exclude using gist (daterange(starts_on, ends_on, '[]') with &&)
);

alter table public.school_closures enable row level security;
revoke all on table public.school_closures from anon, authenticated;
grant select on table public.school_closures to authenticated;

-- Календар бачить кожен авторизований користувач; гість — нічого (AC-CAL-02, AC-CAL-14).
create policy school_closures_select on public.school_closures
  for select to authenticated
  using ((select auth.uid()) is not null);

-- ── Додавання закриття ─────────────────────────────────────────────────────────────────────────────────────
create function private.add_school_closure(
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_closed_from time default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_overlaps jsonb;
  v_records jsonb;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if (select private.current_app_role()) is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_starts_on is null or p_ends_on is null then
    raise exception 'invalid closure' using errcode = '22023';
  end if;

  -- Одночасні додавання закриттів виконуються по черзі: перевірки нижче бачать усі попередні.
  perform pg_advisory_xact_lock(hashtext('school_closures'));

  if v_name = '' then
    return jsonb_build_object('ok', false, 'code', 'name_empty');
  end if;
  if char_length(v_name) > 100 then
    return jsonb_build_object('ok', false, 'code', 'name_too_long');
  end if;
  if p_ends_on < p_starts_on then
    return jsonb_build_object('ok', false, 'code', 'end_before_start');
  end if;
  if p_closed_from is not null and (
    p_starts_on <> p_ends_on
    or p_closed_from <= time '00:00'
    or extract(second from p_closed_from) <> 0
    or mod(extract(minute from p_closed_from)::int, 5) <> 0
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_time');
  end if;

  -- Перетин: по одному запису на кожне закриття, з його першою спільною датою, за датами (AC-CAL-11).
  select coalesce(jsonb_agg(
           jsonb_build_object('date', to_char(o.first_date, 'YYYY-MM-DD'), 'name', o.name)
           order by o.first_date, o.name
         ), '[]'::jsonb)
    into v_overlaps
  from (
    select greatest(c.starts_on, p_starts_on) as first_date, c.name
    from public.school_closures as c
    where daterange(c.starts_on, c.ends_on, '[]') && daterange(p_starts_on, p_ends_on, '[]')
  ) as o;
  if jsonb_array_length(v_overlaps) > 0 then
    return jsonb_build_object('ok', false, 'code', 'overlap', 'overlaps', v_overlaps);
  end if;

  -- Записи, що блокують закриття (AC-CAL-07, 08): чекають рішення, повернуті на доопрацювання, погоджені.
  -- «Rejected» і «Cancelled» не блокують. Для скороченого дня блокують лише записи, у яких є хвилини в блоках розкладу
  -- після часу закриття.
  select coalesce(jsonb_agg(
           jsonb_build_object('date', to_char(b.leave_date, 'YYYY-MM-DD'), 'email', b.email)
           order by b.leave_date, b.email
         ), '[]'::jsonb)
    into v_records
  from (
    select r.leave_date, p.email
    from public.leave_records as r
    join public.profiles as p on p.id = r.employee_id
    where r.leave_date between p_starts_on and p_ends_on
      and r.status in ('awaiting_decision', 'returned_for_revision', 'approved')
      and (
        p_closed_from is null
        or exists (
          select 1 from public.schedule_blocks as sb
          where sb.position_id = r.position_id
            and sb.weekday = extract(isodow from r.leave_date)::int
            and least(r.ends_at, sb.ends_at) > greatest(r.starts_at, sb.starts_at, p_closed_from)
        )
      )
  ) as b;
  if jsonb_array_length(v_records) > 0 then
    return jsonb_build_object('ok', false, 'code', 'blocked', 'records', v_records);
  end if;

  insert into public.school_closures (name, starts_on, ends_on, closed_from, created_by)
  values (v_name, p_starts_on, p_ends_on, p_closed_from, v_uid)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ── Видалення закриття ─────────────────────────────────────────────────────────────────────────────────────
create function private.remove_school_closure(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if (select private.current_app_role()) is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('school_closures'));

  delete from public.school_closures where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── Обгортки для застосунку (security invoker) і права ─────────────────────────────────────────────────────
create function public.add_school_closure(
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_closed_from time default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.add_school_closure(p_name, p_starts_on, p_ends_on, p_closed_from);
$$;

create function public.remove_school_closure(p_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.remove_school_closure(p_id);
$$;

revoke execute on function
  private.add_school_closure(text, date, date, time),
  private.remove_school_closure(uuid),
  public.add_school_closure(text, date, date, time),
  public.remove_school_closure(uuid)
  from public, anon;
grant execute on function
  private.add_school_closure(text, date, date, time),
  private.remove_school_closure(uuid),
  public.add_school_closure(text, date, date, time),
  public.remove_school_closure(uuid)
  to authenticated;
