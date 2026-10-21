-- Записи однієї посади не перетинаються в часі, поки мають статус «Awaiting decision», «Returned for revision»
-- або «Approved» (AC-LEAVE-13, AC-LEAVE-16; припущення PM у вимозі 01). Статуси «Rejected» і «Cancelled» не блокують.
--
-- Застосунок перевіряє перетини наперед (чиста функція planRequest, тексти повідомлень PM). Це обмеження — страховка
-- від гонки двох одночасних заявок: порушення (SQLSTATE 23P01) відкочує всю транзакцію create_leave_request,
-- тож «все або нічого» зберігається і при гонці. Рішення — docs/decisions/0001-model-leave-entries.md.

-- Розширення дає gist-оператор рівності для uuid, потрібний обмеженню виключення.
create extension if not exists btree_gist with schema extensions;

-- ── РИЗИК: чистка даних перед обмеженням ────────────────────────────────────
-- Обмеження виключення не створиться, якщо в таблиці вже є два активні записи однієї посади, що перетинаються:
-- до цієї міграції застосунок такого не забороняв, а тестові дані з ручних перевірок могли їх створити.
-- Тому для кожної такої пари залишаємо ранішу заявку, а пізнішу позначаємо «cancelled». Дані — лише синтетичні
-- демо-записи; якщо перетинів немає, оператор нічого не змінює. Якщо перетини утворюють ланцюжок (A↔B, B↔C),
-- скасовується кожен запис, що перетинається з ранішим, навіть якщо той теж буде скасований: це допустима
-- надлишковість для навчальних даних.
update public.leave_records as r
set status = 'cancelled'
where r.status in ('awaiting_decision', 'returned_for_revision', 'approved')
  and exists (
    select 1
    from public.leave_records as o
    where o.id <> r.id
      and o.position_id = r.position_id
      and o.leave_date = r.leave_date
      and o.status in ('awaiting_decision', 'returned_for_revision', 'approved')
      and o.starts_at < r.ends_at
      and r.starts_at < o.ends_at
      and (o.created_at, o.id) < (r.created_at, r.id)
  );

-- ── Обмеження виключення ────────────────────────────────────────────────────
-- Інтервал [початок, кінець): запис 09:00–11:00 і запис 11:00–12:00 не перетинаються.
alter table public.leave_records
  add constraint leave_records_no_overlap
  exclude using gist (
    position_id with =,
    tsrange(leave_date + starts_at, leave_date + ends_at, '[)') with &&
  )
  where (status in ('awaiting_decision', 'returned_for_revision', 'approved'));
