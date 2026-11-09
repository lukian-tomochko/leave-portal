# Tasks

Вертикальні задачі: кожна — міграція/RLS (де потрібно) + доменна функція + Server Action/сторінка + тести. Кожна задача —
окремий PR «Реалізація» (`task/<коротко>`), у тому самому PR оновлюємо рядки `docs/conformance.md` для її AC. Перевірка:
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run ac:coverage`, `npm run spec:check`,
`npm run check:design`, `npm run check:boundary`, `npm run gates`. Перед кодом сторінок читаємо `node_modules/next/dist/docs/`.
Скрізь: лише синтетичні дані (`*@example.test`), `getClaims()` замість `getSession()`, роль із `profiles`, тести —
`it("AC-…: …")` у `*.test.ts(x)` з `expect(…)`; після злиття — зелений `db-deploy`.

Кожна задача має окремий пункт тестів на відмовні AC і доказ, що тест здатен упасти: SQL-мутант (`npm run mutation:sql` →
`KILLED`) для правил бази, Stryker або ручний мутант для TS.

## 1. Кінець відпустки на початку наступного блоку (AC-LEAVE-22)

- [x] 1.1 Тест спершу (нова сесія агента): unit на `validateHours` і тест бази на PGlite для 09:00–12:30 при блоках 08:30–12:00 і
  12:30–15:30 (запис 3 год, проміжок не рахується).
- [x] 1.2 `schedule.ts:validateHours`: кінець може дорівнювати початку наступного блоку; нова міграція замінює
  `private.create_leave_request_impl` і `private.update_leave_record_hours` (`create or replace`, ті самі `grant`).
- [x] 1.3 SQL-мутант на умову «кінець = початок наступного блоку» у `scripts/mutants.mjs` → `KILLED`.
  Done when: AC-LEAVE-22 — unit і тест бази зелені; без умови тест червоний; рядок матриці `реалізовано`.

## 2. База й права: таблиця закриттів і функції (AC-CAL-01, 07, 08, 10, 11, 13)

- [x] 2.1 Міграція: `public.school_closures` (D4), RLS і `grant select`, exclusion за діапазоном дат. Допоміжну `private.closed_from(date)` створює міграція задачі 3 (`20261109150000_closures_in_requests.sql`).
- [x] 2.2 `private.add_school_closure` і `private.remove_school_closure` (D5) з обгортками `public.*`; типи в `database.types.ts`; ADR 0007.
- [x] 2.3 Тести бази на PGlite (`tests/db/school-calendar.test.ts`), кожна відмова перевіряє незмінні дані: AC-CAL-07
  (затверджений запис блокує), AC-CAL-08 (відхилений не блокує), AC-CAL-10 (кінець раніше за початок), AC-CAL-11
  (перетин), AC-CAL-13 (менеджер напряму → `42501`, календар не змінився); позитивний AC-CAL-01 на рівні даних.
- [x] 2.4 SQL-мутанти: прибрана перевірка ролі; `rejected` додано до блокуючих статусів; `<` → `<=` у порівнянні дат;
  прибраний чек перетину → `KILLED`.
  Done when: AC-CAL-01 (дані), AC-CAL-07, AC-CAL-08, AC-CAL-10, AC-CAL-11, AC-CAL-13 — тести бази зелені, мутанти вбиті, `db-deploy` застосовує міграцію.

## 3. Закриття в заявці (AC-CAL-03, 04, 05, 09)

- [x] 3.1 `src/lib/leave/closures.ts` (`Closure`, `closureOn`, `openBlocks`, валідація назви й дат) із unit-тестами;
  додати до `FLOORED` у `vitest.coverage.config.mts`.
- [x] 3.2 `PlanContext.closures`, `planRequest`/`checkChange` через `openBlocks`, `skippedClosed`, `SCHOOL_CLOSED`; `use-cases.ts`
  і репозиторій читають закриття; повідомлення в `messages.ts`; форма показує закриту дату одразу.
- [x] 3.3 Міграція: закриття в `private.create_leave_request_impl` і `private.update_leave_record_hours` (D6); тест бази, що
  пряма заявка на закритий день відхилена; SQL-мутант на цей чек.
  Done when: AC-CAL-03, AC-CAL-04, AC-CAL-05, AC-CAL-09 (половина заявки) — unit і тести бази зелені, мутант убитий.

## 4. Закриття в балансі (AC-CAL-06)

- [x] 4.1 `BalanceInputs.closures`, `supabase-balance-repository.ts` читає `school_closures`; `balance.ts` без приватного
  `blocksOn`, `workingMinutes`/`recordMinutes` через `openBlocks`.
- [x] 4.2 Unit: скорочений день 12:00, один запис 08:30–12:00 → 1.00 (210/210), а не 0.50; ручний мутант на `openBlocks` у `workingMinutes`.
  Done when: AC-CAL-06 — unit зелений, без `openBlocks` тест червоний.

## 5. Сторінка календаря (AC-CAL-02, 14, 15)

- [x] 5.1 `/calendar?year=`, помічник навчального року, порожній стан, редирект гостя, пункт навігації «Календар».
- [x] 5.2 Unit на вибір рядків навчального року (закриття через 31.08 у двох роках).
  Done when: AC-CAL-02, AC-CAL-14, AC-CAL-15 — сторінка працює, unit зелений (e2e — задача 7).

## 6. Керування календарем (AC-CAL-01, 07–12)

- [x] 6.1 `/calendar/manage`: форма, список, `Dialog` видалення; Server Actions з `getClaims()` і перевіркою `admin`;
  відображення відмов за кодами jsonb; пункт «Керувати календарем» лише для адміністратора.
- [x] 6.2 Тести дій (мок репозиторію не доводить відмову; відмову доводить база з задачі 2).
  Done when: AC-CAL-01, AC-CAL-07, AC-CAL-08, AC-CAL-09, AC-CAL-10, AC-CAL-11, AC-CAL-12 — сторінка й дії працюють.

## 7. UAT на кожен AC зрізу 3

- [x] 7.1 Специфікації Playwright на AC-CAL-01…15 і AC-LEAVE-22 (`given/when/thenStep`, дослівне «Тоді»); роль `admin` у `auth.setup.ts`;
  `@writes` з прибиранням в `afterEach` (закриття через інтерфейс адміністратора, засіяні записи) і teardown (синтетичні користувачі).
- [x] 7.2 Прогін на проді, звіт `docs/qa/uat/<дата>/`, негативний контроль, відео вкладенням у PR.
  Done when: усі AC-CAL-01…15 і AC-LEAVE-22 мають рядок звіту UAT або запис у «Не перевірено» з причиною.

## 8. Proof pack, акаунти й ретро

- [x] 8.1 `docs/qa/proof-pack.md` за шаблоном WS9 (рядок на кожен AC і розділ «Не перевірено»), `docs/conformance.md`,
  `docs/qa/retro-ws9.md`; архів `impl-school-calendar` в останньому PR.
  Done when: рядок на кожен AC-CAL-01…15 і AC-LEAVE-22; `npm run ac:coverage` зелений; `/api/health` = SHA `main`.
