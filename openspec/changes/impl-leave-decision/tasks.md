# Tasks

Вертикальні задачі: кожна — міграція/RLS (де потрібно) + доменна функція + Server Action/сторінка + тести. Кожна задача —
окремий PR «Реалізація» (`task/<коротко>`), у тому самому PR оновлюємо рядки `docs/conformance.md` для її AC. Перевірка:
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run ac:coverage`, `npm run spec:check`,
`npm run check:design`, `npm run check:boundary`. Перед кодом сторінок читаємо `node_modules/next/dist/docs/`.
Скрізь: лише синтетичні дані (`*@example.test`), `getClaims()` замість `getSession()`, роль із `profiles`, тести —
`it("AC-DECIDE-NN: …")` у `*.test.ts(x)` з `expect(…)`.

Кожна задача має **окремий пункт тестів на відмовні AC і мутаційну перевірку**: для кожного відмовного AC PR таблиця
«AC → що тимчасово прибрали → який тест упав», а для двох AC за зріз — червоний прогін CI на коміті `mutation: …` і revert.

## 1. База й права: функції рішення, журнал, політики читання

- [ ] 1.1 Тести бази на PGlite: `npm i -D -E @electric-sql/pglite`, `tests/db/supabase-pglite.ts` (взято з демо, адаптовано:
  користувачі з `demo-users.json`, `asUser`, `asService`, `asAnon`).
- [ ] 1.2 Міграція `leave_decisions`: таблиця журналу з RLS і `grant select`; хелпери `private.can_see_record`,
  `private.manages_request`, `private.manages_employee`; розширені політики `select` на `leave_records`, `leave_requests`,
  `profiles`, `leave_decisions`; функції `private.decide_leave_record`, `private.update_leave_record_hours`,
  `private.cancel_leave_record` і обгортки `public.*`. Без `grant update` на `leave_records` і `leave_requests`.
  Типи в `src/lib/supabase/database.types.ts`. ADR 0004 (функції бази замість прямих `update`).
- [ ] 1.3 Тести відмов (`tests/db/leave-decision.test.ts`), кожен перевіряє відмову і незмінні дані:
  AC-DECIDE-04 (повернення без коментаря), AC-DECIDE-07 (другий менеджер після схвалення першого), AC-DECIDE-08 (менеджер чужої посади), AC-DECIDE-09 (працівник
  вирішує власний запис), AC-DECIDE-18 (менеджер власний запис), AC-DECIDE-12 (зміна годин схваленого запису),
  AC-DECIDE-17 (скасований запис кінцевий), AC-DECIDE-21 (працівник не змінює тип відпустки напряму); позитивні:
  AC-DECIDE-01 (менеджер читає лише записи своєї посади), AC-DECIDE-10 і AC-DECIDE-19 (адміністратор вирішує будь-який і власний запис
  менеджера), AC-DECIDE-15 (працівник бачить автора рішення, сторонній не бачить).
- [ ] 1.4 Мутаційна перевірка: послабити перевірку ролі, права менеджера, перевірку власного запису й `grant` — тест
  червоніє; таблиця в описі PR; два червоні прогони CI (`mutation: …`) і revert.
  Done when: AC-DECIDE-01, AC-DECIDE-04, AC-DECIDE-07, AC-DECIDE-08, AC-DECIDE-09, AC-DECIDE-10, AC-DECIDE-12,
  AC-DECIDE-15, AC-DECIDE-17, AC-DECIDE-18, AC-DECIDE-19, AC-DECIDE-21 — тести бази зелені, а без політики чи перевірки відповідний тест червоний; `db-check` і
  `db-deploy` застосовують міграцію.

## 2. Інтерфейс менеджера: списки, запис і рішення

- [ ] 2.1 Доменні функції й порт: `src/lib/leave/decision.ts` (правила повернення з коментарем, мапінг відповідей бази
  на повідомлення PM), розширення `LeaveRepository` і `supabase-repository.ts` (`listAwaiting`, `listHistory`,
  `getRecord`, `decide`); тексти в `messages.ts`.
- [ ] 2.2 Сторінки `/decisions`, `/decisions/history`, `/records/[id]`; Server Action `decideLeaveRecord` з `getClaims()`
  і перевіркою ролі; `Dialog` підтвердження для Approve/Reject; пункт «Рішення» в шапці лише для менеджера й адміністратора;
  порожній стан і помилки дослівно з AC; демо-користувачі `pm-*@example.test` і сид посади/менеджера для PM.
- [ ] 2.3 Тести (`*.test.ts` з фейковим репозиторієм): повідомлення й правила, фільтр за відповідальними посадами,
  історія. Тест відмов: AC-DECIDE-04 (повернення без коментаря), AC-DECIDE-07, AC-DECIDE-18 — повідомлення PM.
- [ ] 2.4 Мутаційна перевірка для відмовних AC цього PR (таблиця в описі).
  Done when: AC-DECIDE-01, AC-DECIDE-02, AC-DECIDE-03, AC-DECIDE-04, AC-DECIDE-05, AC-DECIDE-11, AC-DECIDE-14,
  AC-DECIDE-15, AC-DECIDE-20, AC-DECIDE-23, AC-DECIDE-24 — тести зелені; на проді `pm-manager@example.test` бачить лише
  записи своєї посади, схвалює один із записів, і той переходить у «History».

## 3. Сторона працівника: рішення, зміна годин, скасування

- [ ] 3.1 «My requests» показує коментар менеджера й посилання на запис; на `/records/[id]` власник змінює години
  (зі статусу «Returned for revision» запис знову в «Awaiting decision») і скасовує запис; дії `updateLeaveRecordHours` і
  `cancelLeaveRecord` з `getClaims()`; повідомлення PM (AC-DECIDE-12, AC-DECIDE-21, AC-DECIDE-22), перевірка годин за
  розкладом і перетину.
- [ ] 3.2 Тести: AC-DECIDE-06, AC-DECIDE-13, AC-DECIDE-16 (позитивні); відмови AC-DECIDE-12, AC-DECIDE-21, AC-DECIDE-22 —
  повідомлення й незмінні дані. Мутаційна перевірка. Архівуємо зміну (`npx openspec archive impl-leave-decision -y`) в
  цьому PR; `docs/conformance.md` — усі 24 рядки AC-DECIDE; скріни за ролями в `docs/img/`.
  Done when: AC-DECIDE-06, AC-DECIDE-13, AC-DECIDE-16, AC-DECIDE-22 — тести зелені; запис екрана з прод-URL: працівник
  бачить рішення з коментарем, змінює години повернутого запису й скасовує інший.
