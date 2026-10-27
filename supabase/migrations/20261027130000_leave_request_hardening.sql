-- Подання заявки лише через функцію бази: прямий insert і довільні дані через Data API більше не проходять.
--
-- Проблема (ревʼю WS6, знахідки 2 і 3): `authenticated` мав `grant insert` на `leave_requests` і `leave_records`, а
-- `public.create_leave_request` була `security invoker` і перевіряла лише, що масив записів непорожній. Через Data API
-- (публічний ключ і власний JWT) можна було створити запис на суботу чи на 06:00–23:00, заявку без записів або запис із
-- `request_id` чужої заявки (після чого «My requests» цього працівника падала).
--
-- Рішення (docs/decisions/0006-leave-request-via-private-function.md):
--   1. `revoke insert` на обох таблицях для `authenticated`;
--   2. вставка й перевірки — у `private.create_leave_request_impl` (`security definer`, `set search_path = ''`):
--      сесія, власна посада, початок < кінець, години в межах розкладу посади в цей день тижня;
--   3. `public.create_leave_request` лишається тонкою обгорткою `security invoker` з тією самою сигнатурою;
--   4. складений зовнішній ключ (request_id, employee_id): запис не може посилатися на чужу заявку.
--
-- Правило розкладу — те саме, що в `private.update_leave_record_hours` і `validateHours`: початок припадає на блок
-- (початок блоку включно, кінець блоку ні), кінець припадає на блок (початок блоку ні, кінець блоку включно); блоків на
-- день може бути кілька, проміжок між ними входить у години відсутності (AC-LEAVE-15).
--
-- РИЗИК: (а) `revoke insert` — застосунок вставляє лише через `public.create_leave_request`, прямих insert немає;
-- (б) складений ключ перевіряє наявні дані: міграція зупиниться з повідомленням, якщо є запис із чужою заявкою. Дані не
-- змінюються й не видаляються. Відкат — нова міграція: повернути `grant insert` і попередню `security invoker` функцію.

-- ── 1. Складений ключ: запис належить тому самому працівнику, що й заявка ───────────────────────────────────────
do $$
begin
  if exists (
    select 1
    from public.leave_records as r
    join public.leave_requests as q on q.id = r.request_id
    where q.employee_id <> r.employee_id
  ) then
    raise exception 'leave_records with a request of another employee exist: fix the data before applying'
      using errcode = '23514';
  end if;
end;
$$;

alter table public.leave_requests
  add constraint leave_requests_id_employee_key unique (id, employee_id);

alter table public.leave_records
  add constraint leave_records_request_owner_fkey
  foreign key (request_id, employee_id) references public.leave_requests (id, employee_id) on delete cascade;

-- ── 2. Прямого insert більше немає ──────────────────────────────────────────────────────────────────────────
revoke insert on table public.leave_requests, public.leave_records from authenticated;

-- ── 3. Вставка й перевірки в private ────────────────────────────────────────────────────────────────────────
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
          and v_ends > b.starts_at and v_ends <= b.ends_at
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

revoke execute on function private.create_leave_request_impl(text, jsonb, text, text) from public, anon;
grant execute on function private.create_leave_request_impl(text, jsonb, text, text) to authenticated;

-- ── 4. Публічна обгортка (та сама сигнатура й права, що були) ───────────────────────────────────────────────
create or replace function public.create_leave_request(
  p_leave_type text,
  p_records jsonb,
  p_relationship text default null,
  p_comment text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_leave_request_impl(p_leave_type, p_records, p_relationship, p_comment);
$$;

revoke execute on function public.create_leave_request(text, jsonb, text, text) from public, anon;
grant execute on function public.create_leave_request(text, jsonb, text, text) to authenticated;
