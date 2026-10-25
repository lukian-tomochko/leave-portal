-- Зміна годин запису працівником лише в межах розкладу посади (вимога 01: AC-LEAVE-19, AC-LEAVE-20; вимога 02: AC-DECIDE-16).
--
-- Застосунок перевіряє години наперед (validateHours, тексти PM), але функція update_leave_record_hours доступна ролі
-- authenticated напряму, тож без перевірки в самій базі працівник міг би зберегти час поза розкладом (наприклад,
-- 00:00–23:55) прямим викликом. Тут та сама функція отримує перевірку розкладу. Інші перевірки (сесія, власник запису,
-- статус, порядок часу, блокування лише власного рядка) лишаються як у 20261025090000_leave_decisions.sql.
--
-- Правило розкладу, як у застосунку: початок припадає на блок (початок блоку включно, кінець блоку ні), кінець припадає
-- на блок (початок блоку ні, кінець блоку включно). Блоків на день може бути кілька, проміжок між ними входить у години
-- відсутності так само, як у validateHours.
--
-- РИЗИК: create or replace функції. Права execute (revoke від public і anon, grant authenticated) зберігаються, дані
-- не змінюються. Відкат — повернути попередню версію функції новою міграцією.

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
        and p_ends_at > b.starts_at and p_ends_at <= b.ends_at
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
