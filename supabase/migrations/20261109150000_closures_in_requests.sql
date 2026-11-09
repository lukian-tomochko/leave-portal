-- Закриття шкільного календаря в заявках (вимога 04: AC-CAL-03, AC-CAL-04, AC-CAL-05, AC-CAL-09).
--
-- Закритий день не приймається в заявці, на скороченому дні години рахуються лише до часу закриття, а після видалення
-- закриття день знову робочий. Застосунок перевіряє це наперед (planRequest, тексти PM), але функції створення заявки й
-- зміни годин доступні ролі authenticated напряму, тож те саме правило має тримати база: пряма заявка в обхід сторінок
-- на закритий день відхиляється (22023 school_closed), а години на скороченому дні перевіряються за відкритою частиною
-- розкладу (22023 hours_outside_schedule).
--
-- Допоміжна private.closed_from(дата): NULL — день відкритий, 00:00 — закриті цілі дні, інакше час скороченого дня.
-- Створення запису й зміна годин беруть розділене advisory-блокування 'school_closures', а додавання закриття —
-- ексклюзивне, тож «додали закриття» й «створили запис» не розминуться (див. 20261109120000_school_closures.sql).
--
-- РИЗИК: create or replace двох функцій (права execute зберігаються), дані не змінюються. Відкат — повернути
-- попередні версії з 20261109090000_leave_hours_end_at_block_start.sql новою міграцією.

create function private.closed_from(p_date date)
returns time
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.closed_from, time '00:00')
  from public.school_closures as c
  where c.starts_on <= p_date and p_date <= c.ends_on
  limit 1;
$$;

revoke execute on function private.closed_from(date) from public, anon;

create or replace function private.create_leave_request_impl(
  p_leave_type text,
  p_records jsonb,
  p_relationship text default null,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_record jsonb;
  v_position_id uuid;
  v_date date;
  v_starts time;
  v_ends time;
  v_weekday int;
  v_closed_from time;
  v_cut time;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) = 0 then
    raise exception 'p_records must be a non-empty array' using errcode = '22023';
  end if;

  -- Закриття не додається, поки ця заявка перевіряється й вставляється.
  perform pg_advisory_xact_lock_shared(hashtext('school_closures'));

  -- Усі перевірки до першої вставки: заявка або створюється цілою, або не створюється.
  for v_record in select * from jsonb_array_elements(p_records)
  loop
    v_position_id := (v_record ->> 'position_id')::uuid;
    v_date := (v_record ->> 'leave_date')::date;
    v_starts := (v_record ->> 'starts_at')::time;
    v_ends := (v_record ->> 'ends_at')::time;

    if v_position_id is null or v_date is null or v_starts is null or v_ends is null or v_ends <= v_starts then
      raise exception 'invalid record' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.positions as p where p.id = v_position_id and p.employee_id = v_uid
    ) then
      raise exception 'forbidden' using errcode = '42501';
    end if;

    -- Закриті цілі дні не приймаються; на скороченому дні розклад закінчується в час закриття (AC-CAL-03, AC-CAL-05).
    v_closed_from := private.closed_from(v_date);
    if v_closed_from = time '00:00' then
      raise exception 'school_closed' using errcode = '22023';
    end if;
    v_cut := coalesce(v_closed_from, time '24:00');

    -- 1 = понеділок … 7 = неділя
    v_weekday := extract(isodow from v_date)::int;
    if not (
      exists (
        select 1 from public.schedule_blocks as b
        where b.position_id = v_position_id and b.weekday = v_weekday
          and v_starts >= b.starts_at and v_starts < least(b.ends_at, v_cut)
      )
      and exists (
        select 1 from public.schedule_blocks as b
        where b.position_id = v_position_id and b.weekday = v_weekday and b.starts_at < v_cut
          and ((v_ends > b.starts_at and v_ends <= least(b.ends_at, v_cut)) or v_ends = b.starts_at)
      )
    ) then
      raise exception 'hours_outside_schedule' using errcode = '22023';
    end if;
  end loop;

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

create or replace function private.update_leave_record_hours(p_record_id uuid, p_starts_at time, p_ends_at time)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_record public.leave_records%rowtype;
  v_weekday int;
  v_closed_from time;
  v_cut time;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'invalid hours' using errcode = '22023';
  end if;

  -- Закриття не додається, поки ця зміна годин перевіряється й записується.
  perform pg_advisory_xact_lock_shared(hashtext('school_closures'));

  -- Блокуємо лише власний рядок: чужий запис не можна притримати блокуванням.
  select * into v_record from public.leave_records where id = p_record_id and employee_id = v_uid for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_record.status not in ('awaiting_decision', 'returned_for_revision') then
    return jsonb_build_object('ok', false, 'status', v_record.status);
  end if;

  v_closed_from := private.closed_from(v_record.leave_date);
  if v_closed_from = time '00:00' then
    raise exception 'school_closed' using errcode = '22023';
  end if;
  v_cut := coalesce(v_closed_from, time '24:00');

  -- Години лише в межах відкритої частини розкладу цієї посади в цей день тижня (1 = понеділок … 7 = неділя).
  v_weekday := extract(isodow from v_record.leave_date)::int;
  if not (
    exists (
      select 1 from public.schedule_blocks as b
      where b.position_id = v_record.position_id and b.weekday = v_weekday
        and p_starts_at >= b.starts_at and p_starts_at < least(b.ends_at, v_cut)
    )
    and exists (
      select 1 from public.schedule_blocks as b
      where b.position_id = v_record.position_id and b.weekday = v_weekday and b.starts_at < v_cut
        and ((p_ends_at > b.starts_at and p_ends_at <= least(b.ends_at, v_cut)) or p_ends_at = b.starts_at)
    )
  ) then
    raise exception 'hours_outside_schedule' using errcode = '22023';
  end if;

  update public.leave_records
  set starts_at = p_starts_at, ends_at = p_ends_at, status = 'awaiting_decision'
  where id = p_record_id;

  return jsonb_build_object('ok', true, 'status', 'awaiting_decision');
end;
$$;
