# Матриця відповідності (AC → код → тест → статус)

<!--
Ваша матриця: один рядок на кожен AC з openspec/specs/** — вашої специфікації, у яку ви перекладаєте вимоги PM
(їхній знімок у requirements/ приносить команда агента /requirements-sync).
Рядок «Вимоги» під цим коментарем заповнює лише /requirements-sync: адреса репо вимог PM, звідки взято вимоги (issues
або файли docs/), і дата знімка, через « · ». Руками його не змінюйте: з нього /requirements-sync знає, звідки брати
вимоги наступного разу, а скіли spec-clarify, spec-review і /conformance — куди ставити питання й яку версію вимог ви
реалізуєте. Рядків таблиці /requirements-sync не додає.
Рядки змінюєте ви:
  PR «Специфікація» — після archive зміни: рядок кожного нового AC зі статусом «відкладено (чекає реалізації)»; рядки AC,
                      прибраних зі специфікації (REMOVED), — видалити;
  PR «Реалізація»   — рядок AC задачі в тому самому PR, що й код і тест.
Перебудувати автоматично: /conformance (Claude Code, Cursor).
Перевірка в CI: npm run ac:coverage — падає, якщо
  NO-ROW     AC є в специфікації, а рядка немає (типово — PR «Специфікація» без нових рядків або рядок видалено);
  MISSING    статус «реалізовано», а непропущеного тесту, назва якого починається з цього AC ID, у файлах
             *.test.ts / *.test.tsx немає (*.spec.ts і допоміжні файли Vitest не запускає — вони не рахуються);
  ORPHAN     тест посилається на AC, якого немає в специфікації (AC прибрано або вимогу PM ще не перекладено);
  BAD-STATUS статус не «реалізовано» і не «відкладено (причина)»;
  WRONG-REF  шляху `src/…`/`tests/…`/`supabase/…` з колонок «Код»/«Тест» немає або тест із цим AC в іншому файлі;
і попереджає, не падаючи: AC з вимог PM (requirements/), якого ще немає в openspec/specs/, — «вимогу PM ще не перекладено
в специфікацію».

Приклад рядків (усередині коментаря — скрипт їх не читає):
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/multi.test.ts` | реалізовано |
-->

Вимоги: https://github.com/mkozlovskyi-ops/course-staff-management-spec · джерело: docs · знімок 2026-10-24

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-LEAVE-01 | Цілий день на одній посаді | `src/lib/leave/request.ts` (planRequest), `src/app/leave/actions.ts` (submitLeaveRequest) | `src/lib/leave/request.test.ts` | реалізовано |
| AC-LEAVE-02 | Дві посади в одній заявці | `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/multi.test.ts` | реалізовано |
| AC-LEAVE-03 | Додаткова посада виключена | `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/multi.test.ts` | реалізовано |
| AC-LEAVE-05 | Дві дати в одній заявці | `src/lib/leave/use-cases.ts` (submitRequest), `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/use-cases.test.ts` | реалізовано |
| AC-LEAVE-04 | Частина дня за годинами | `src/lib/leave/schedule.ts` (validateHours), `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/hours.test.ts` | реалізовано |
| AC-LEAVE-15 | Заявка через проміжок між блоками | `src/lib/leave/schedule.ts` (validateHours), `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/hours.test.ts` | реалізовано |
| AC-LEAVE-06 | Субота без розкладу | `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/hours.test.ts` | реалізовано |
| AC-LEAVE-07 | Години раніше за початок блоку | `src/lib/leave/schedule.ts` (validateHours), `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/hours.test.ts` | реалізовано |
| AC-LEAVE-19 | Години поза розкладом з кількох блоків | `src/lib/leave/schedule.ts` (validateHours), `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/hours.test.ts` | реалізовано |
| AC-LEAVE-08 | Початок на кінці блоку | `src/lib/leave/schedule.ts` (validateHours), `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/hours.test.ts` | реалізовано |
| AC-LEAVE-20 | Початок на кінці першого блоку між блоками | `src/lib/leave/schedule.ts` (validateHours), `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/hours.test.ts` | реалізовано |
| AC-LEAVE-09 | Кінець раніше за початок | `src/lib/leave/schedule.ts` (validateHours), `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/hours.test.ts` | реалізовано |
| AC-LEAVE-10 | Усі посади виключені | `src/lib/leave/request.ts` (planRequest) | `src/lib/leave/multi.test.ts` | реалізовано |
| AC-LEAVE-11 | Повернення до редагування без підтвердження | `src/lib/leave/use-cases.ts` (previewRequest), `src/app/leave/new/new-leave-form.tsx` | `src/lib/leave/use-cases.test.ts` | реалізовано |
| AC-LEAVE-12 | "Family celebration" без спорідненості | `src/lib/leave/request.ts` (planRequest), `src/lib/leave/messages.ts` | `src/lib/leave/comment.test.ts` | реалізовано |
| AC-LEAVE-13 | Перетин із записом на розгляді | `src/lib/leave/request.ts` (planRequest), `supabase/migrations/20261021041722_leave_no_overlap.sql` | `src/lib/leave/multi.test.ts` | реалізовано |
| AC-LEAVE-16 | Конфлікт на одній даті скасовує всю заявку | `src/lib/leave/use-cases.ts` (submitRequest), `supabase/migrations/20261021031910_leave_foundation.sql` (create_leave_request) | `src/lib/leave/use-cases.test.ts` | реалізовано |
| AC-LEAVE-14 | Список лише власних записів | `src/lib/leave/use-cases.ts` (listMyRecords), `src/lib/leave/supabase-repository.ts` (listRecords), `src/app/leave/page.tsx` | `src/lib/leave/use-cases.test.ts` | реалізовано |
| AC-LEAVE-17 | Коментар на всіх записах заявки | `src/lib/leave/request.ts` (planRequest), `src/lib/leave/use-cases.ts`, `src/app/leave/new/new-leave-form.tsx` | `src/lib/leave/comment.test.ts` | реалізовано |
| AC-LEAVE-18 | Коментар із 501 символу | `src/lib/leave/request.ts` (planRequest), `src/lib/leave/messages.ts` | `src/lib/leave/comment.test.ts` | реалізовано |
| AC-LEAVE-21 | Дата без годин у заявці на кілька дат | `src/lib/leave/request.ts` (planRequest), `src/app/leave/new/new-leave-form.tsx` | `src/lib/leave/multi.test.ts` | реалізовано |
| AC-DECIDE-01 | RLS: менеджер читає записи лише своїх посад | `supabase/migrations/20261025090000_leave_decisions.sql` (політика leave_records_select) | `tests/db/leave-decision.test.ts` | відкладено (політика й тест бази — у PR task/decision-db; список «Awaiting decision» — у задачі 2) |
| AC-DECIDE-14 | Порожній список | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-02 | Погодження одного з двох записів | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-03 | Відхилення запису | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-04 | Повернення без коментаря | `supabase/migrations/20261025090000_leave_decisions.sql` (private.decide_leave_record) | `tests/db/leave-decision.test.ts` | відкладено (правило бази й тест — у PR task/decision-db; повідомлення «Tell the employee what to fix» — у задачі 2) |
| AC-DECIDE-05 | Повернення з коментарем | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-06 | Виправлення й повторна подача | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-07 | Другий менеджер запізнився | `supabase/migrations/20261025090000_leave_decisions.sql` (private.decide_leave_record) | `tests/db/leave-decision.test.ts` | відкладено (правило бази й тест — у PR task/decision-db; повідомлення «Another manager has already decided» — у задачі 2) |
| AC-DECIDE-08 | Менеджер чужої посади | `supabase/migrations/20261025090000_leave_decisions.sql` (private.decide_leave_record) | `tests/db/leave-decision.test.ts` | реалізовано |
| AC-DECIDE-09 | Працівник без ролі менеджера чи адміністратора | `supabase/migrations/20261025090000_leave_decisions.sql` (private.decide_leave_record, без grant update) | `tests/db/leave-decision.test.ts` | реалізовано |
| AC-DECIDE-10 | Адміністратор погоджує чужий запис | `supabase/migrations/20261025090000_leave_decisions.sql` (private.decide_leave_record, leave_decisions) | `tests/db/leave-decision.test.ts` | відкладено (рішення й журнал у базі та тест — у PR task/decision-db; рядок історії — у задачі 2) |
| AC-DECIDE-18 | Менеджер не погоджує власний запис | `supabase/migrations/20261025090000_leave_decisions.sql` (private.decide_leave_record) | `tests/db/leave-decision.test.ts` | відкладено (правило бази й тест — у PR task/decision-db; повідомлення «Your own record is decided by an administrator» — у задачі 2) |
| AC-DECIDE-19 | Адміністратор погоджує запис менеджера | `supabase/migrations/20261025090000_leave_decisions.sql` (private.decide_leave_record) | `tests/db/leave-decision.test.ts` | відкладено (правило бази й тест — у PR task/decision-db; сторінка рішення — у задачі 2) |
| AC-DECIDE-11 | Погоджений запис іде в історію | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-15 | Історія рішення: дата, хто вирішив, рішення | `supabase/migrations/20261025090000_leave_decisions.sql` (leave_decisions, private.sees_decider) | `tests/db/leave-decision.test.ts` | відкладено (читання журналу й профілю автора рішення в базі та тест — у PR task/decision-db; рядок історії на сторінці запису — у задачі 2) |
| AC-DECIDE-12 | Зміна погодженого запису | `supabase/migrations/20261025090000_leave_decisions.sql` (private.update_leave_record_hours) | `tests/db/leave-decision.test.ts` | відкладено (правило бази й тест — у PR task/decision-db; повідомлення «This record is already approved» — у задачі 3) |
| AC-DECIDE-16 | Працівник змінює години до рішення | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-13 | Скасування запису на розгляді | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-17 | Скасування повернутого запису | `supabase/migrations/20261025090000_leave_decisions.sql` (private.cancel_leave_record) | `tests/db/leave-decision.test.ts` | відкладено (правило бази й тест — у PR task/decision-db; кнопка скасування — у задачі 3) |
| AC-DECIDE-20 | Менеджер бачить коментар працівника | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-21 | Зміна типу відпустки заборонена | `supabase/migrations/20261025090000_leave_decisions.sql` (без grant update на leave_requests) | `tests/db/leave-decision.test.ts` | відкладено (заборона в базі й тест — у PR task/decision-db; повідомлення PM — у задачі 3) |
| AC-DECIDE-22 | Зміна годин із перетином | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-23 | Відхилення з коментарем | — | — | відкладено (чекає реалізації) |
| AC-DECIDE-24 | Погодження з коментарем | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-01 | Початкові баланси | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-02 | Погоджений цілий день | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-03 | Частина дня | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-05 | Дві посади в одну дату | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-06 | Цілий день лише додаткової посади | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-04 | Запис на розгляді не зменшує баланс | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-07 | Відхилений запис не зменшує баланс | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-08 | Перевищення залишку на цілий день | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-15 | Перевищення залишку частиною дня | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-17 | Одне попередження для заявки на кілька дат | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-09 | Попередження менеджеру | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-14 | Залишок після попереднього погодження | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-10 | Погодження із запропонованим розподілом | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-18 | Запис із розподілом лишається одним | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-19 | Розподіл при нульовому залишку | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-16 | Спроба погодити без розподілу | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-11 | Перенесення залишку Sick leave | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-12 | Менеджер без посад працівника | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-13 | Працівник не бачить чужих балансів | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-20 | Менеджер додаткової посади бачить повний баланс | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-21 | Пізнє погодження за минулий рік | — | — | відкладено (чекає реалізації) |
| AC-BALANCE-22 | Заявка на два навчальні роки | — | — | відкладено (чекає реалізації) |
