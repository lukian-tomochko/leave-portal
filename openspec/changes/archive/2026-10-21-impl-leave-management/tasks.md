# Tasks

Вертикальні задачі: кожна — таблиця/RLS + доменна функція + server action/сторінка + тест. Кожна задача — окремий PR «Реалізація»
(`task/<коротко>`), у тому самому PR оновлюємо рядки `docs/conformance.md` для її AC. Перевірка: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run ac:coverage`. Перед кодом сторінок читаємо `node_modules/next/dist/docs/`.
Скрізь: лише синтетичні дані (`*@example.test`), `getClaims()` замість `getSession()`, тести — `it("AC-LEAVE-NN: …")` у
`*.test.ts(x)` з `expect(…)`.

## 1. Основа й подання заявки на цілий день однієї посади

- [x] 1.1 ADR `docs/decisions/0001-model-leave-entries.md` (модель D2, атомарний запис D3). Міграція ролей
  (`member` → `employee`; набір `employee`/`manager`/`admin`), таблиці `positions`, `position_managers`, `schedule_blocks`,
  `leave_requests`, `leave_records` з RLS і явними `grant`, функція `create_leave_request`; `supabase/demo-users.json`
  (5 користувачів), ідемпотентний `supabase/seed.sql` (посади й розклад лише для наявних профілів);
  `src/lib/supabase/database.types.ts`; `src/lib/leave/{time,schedule,messages,request}.ts` — лише цілий день;
  `/leave/new` і `/leave`, дії `previewLeaveRequest`/`submitLeaveRequest`; тест доменної функції.
  Done when: AC-LEAVE-01 — тест зелений; `db-check` застосовує міграцію; на проді (`users:demo`, CI з `include_seed`)
  `teacher1@example.test` подає заявку на цілий день, і запис «Awaiting decision» видно в «My requests».

## 2. Години в межах розкладу

- [x] 2.1 Поля «з» і «до» (`step=300`) у `/leave/new`; `validateHours` і виведення тривалості; повідомлення PM про помилки;
  дата без робочих годин; розклад із кількох блоків (хвилини лише всередині блоків); тести.
  Done when: AC-LEAVE-04, AC-LEAVE-06, AC-LEAVE-07, AC-LEAVE-08, AC-LEAVE-09, AC-LEAVE-15, AC-LEAVE-19, AC-LEAVE-20 —
  тести зелені; запис 09:00–11:30 має тривалість 2 год 30 хв, а 11:00–13:00 через проміжок — 1 год 30 хв.

## 3. Кілька дат і посад, перетини, «все або нічого»

- [x] 3.1 Вибір кількох дат і посад (з можливістю виключити посаду) у `/leave/new`; крок підсумку й підтвердження, введене
  зберігається до підтвердження; перевірка перетину з наявними записами тієї ж посади; обмеження виключення на
  `leave_records` (нова міграція); атомарний `rpc` і відображення помилки гонки; тести з фейковим репозиторієм.
  Done when: AC-LEAVE-02, AC-LEAVE-03, AC-LEAVE-05, AC-LEAVE-10, AC-LEAVE-11, AC-LEAVE-13, AC-LEAVE-16 — тести зелені;
  заявка на дві посади дає два записи, а конфлікт на одній даті не створює записів ні на одну.

## 4. Коментар, спорідненість і власні записи

- [x] 4.1 Поле коментаря (до 500 символів) і поле спорідненості для "Family celebration"; коментар зберігається на кожному
  записі заявки; `listMyRecords` із захисним фільтром за власником; «My requests» показує дату, години, посаду, тип і
  статус; тести. Архівуємо зміну (`npx openspec archive impl-leave-management -y`) в цьому PR.
  Done when: AC-LEAVE-12, AC-LEAVE-14, AC-LEAVE-17, AC-LEAVE-18 — тести зелені; запис екрана 1–2 хв із прод-URL (вхід
  `teacher1@example.test`, заявка на дві посади, «My requests»).
