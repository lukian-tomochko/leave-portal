-- Лічильник записів «Awaiting decision» для шапки менеджера.
--
-- РИЗИК: лише нові функції, дані не змінюються. Відкат — нова міграція з drop function.

-- Хелпер ролі: менеджер чи адміністратор.
create or replace function private.is_decider()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) in ('manager', 'admin'), false);
$$;

revoke execute on function private.is_decider() from public, anon;
grant execute on function private.is_decider() to authenticated;

-- Кількість записів, що чекають рішення.
create or replace function public.awaiting_decision_count()
returns integer
language sql
stable
security definer
as $$
  select count(*)::int from public.leave_records where status = 'awaiting_decision';
$$;

grant execute on function public.awaiting_decision_count() to anon, authenticated;
