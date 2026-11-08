-- Кінець відпустки може збігатися з початком наступного блоку розкладу (вимога 01: AC-LEAVE-22).
--
-- Раніше кінець мав припадати на блок (початок блоку ні, кінець блоку так), тож 09:00–12:30 при блоках 08:30–12:00 і
-- 12:30–15:30 відхилялося. Тепер кінець також може дорівнювати початку блоку; рахуються лише хвилини всередині блоків
-- (проміжок 12:00–12:30 не входить), як у застосунку (schedule.ts: validateHours).
--
-- Змінюємо обидві функції, що перевіряють години за розкладом: створення заявки (private.create_leave_request_impl) і
-- зміна годин запису (private.update_leave_record_hours). Решта перевірок лишається як у
-- 20261027130000_leave_request_hardening.sql і 20261026080000_leave_hours_in_schedule.sql.
--
-- РИЗИК: create or replace функцій. Права execute (revoke від public і anon, grant authenticated) зберігаються, дані не
-- змінюються. Відкат — повернути попередні версії функцій новою міграцією.

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
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) = 0 then
    raise exception 'p_records must be a non-empty array' using errcode = '22023';
  end if;

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

    -- 1 = понеділок … 7 = неділя
    v_weekday := extract(isodow from v_date)::int;
    if not (
      exists (
        select 1 from public.schedule_blocks as b
        where b.position_id = v_position_id and b.weekday = v_weekday
          and v_starts >= b.starts_at and v_starts < b.ends_at
      )
      and exists (
        select 1 from public.schedule_blocks as b
        where b.position_id = v_position_id and b.weekday = v_weekday
          and ((v_ends > b.starts_at and v_ends <= b.ends_at) or v_ends = b.starts_at)
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
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'invalid hours' using errcode = '22023';
  end if;

  -- Блокуємо лише власний рядок: чужий запис не можна притримати блокуванням.
  select * into v_record from public.leave_records where id = p_record_id and employee_id = v_uid for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_record.status not in ('awaiting_decision', 'returned_for_revision') then
    return jsonb_build_object('ok', false, 'status', v_record.status);
  end if;

  -- Години лише в межах розкладу цієї посади в цей день тижня (1 = понеділок … 7 = неділя).
  v_weekday := extract(isodow from v_record.leave_date)::int;
  if not (
    exists (
      select 1 from public.schedule_blocks as b
      where b.position_id = v_record.position_id and b.weekday = v_weekday
        and p_starts_at >= b.starts_at and p_starts_at < b.ends_at
    )
    and exists (
      select 1 from public.schedule_blocks as b
      where b.position_id = v_record.position_id and b.weekday = v_weekday
        and ((p_ends_at > b.starts_at and p_ends_at <= b.ends_at) or p_ends_at = b.starts_at)
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
