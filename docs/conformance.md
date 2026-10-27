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
| AC-DECIDE-01 | RLS: менеджер читає записи лише своїх посад | `src/lib/leave/decision.ts` (listAwaiting), `src/app/decisions/page.tsx` | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-14 | Порожній список | `src/lib/leave/decision.ts` (awaitingEmptyMessage), `src/app/decisions/page.tsx` | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-02 | Погодження одного з двох записів | `src/lib/leave/decision.ts` (decideRecord), `src/app/decisions/actions.ts` (decideLeaveRecord) | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-03 | Відхилення запису | `src/lib/leave/decision.ts` (decideRecord), `src/app/decisions/actions.ts` (decideLeaveRecord), `src/app/leave/page.tsx` (статус у «My requests») | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-04 | Повернення без коментаря | `src/lib/leave/decision.ts` (decideRecord), `src/app/records/[id]/decision-form.tsx` | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-05 | Повернення з коментарем | `src/lib/leave/supabase-repository.ts` (listRecords: managerComment), `src/app/leave/page.tsx`, `supabase/migrations/20261025090000_leave_decisions.sql` (leave_decisions_select) | `tests/db/leave-decision.test.ts` | реалізовано |
| AC-DECIDE-06 | Виправлення й повторна подача | `src/lib/leave/employee-record.ts` (changeHours, cancelRecord), `src/app/records/[id]/actions.ts`, `src/app/records/[id]/employee-actions.tsx` | `src/lib/leave/employee-record.test.ts` | реалізовано |
| AC-DECIDE-07 | Другий менеджер запізнився | `src/lib/leave/decision.ts` (decideRecord), `src/app/decisions/actions.ts` (decideLeaveRecord) | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-08 | Менеджер чужої посади | `supabase/migrations/20261025090000_leave_decisions.sql` (private.decide_leave_record) | `tests/db/leave-decision.test.ts` | реалізовано |
| AC-DECIDE-09 | Працівник без ролі менеджера чи адміністратора | `supabase/migrations/20261025090000_leave_decisions.sql` (private.decide_leave_record, без grant update) | `tests/db/leave-decision.test.ts` | реалізовано |
| AC-DECIDE-10 | Адміністратор погоджує чужий запис | `src/lib/leave/decision.ts` (formatDecisionLine), `src/app/records/[id]/page.tsx` | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-18 | Менеджер не погоджує власний запис | `src/lib/leave/decision.ts` (decideRecord), `src/app/decisions/actions.ts` (decideLeaveRecord) | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-19 | Адміністратор погоджує запис менеджера | `src/lib/leave/decision.ts` (decideRecord), `src/app/decisions/actions.ts` (decideLeaveRecord) | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-11 | Погоджений запис іде в історію | `src/lib/leave/decision.ts` (listAwaiting, listHistory), `src/app/decisions/history/page.tsx` | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-15 | Історія рішення: дата, хто вирішив, рішення | `src/lib/leave/decision.ts` (formatDecisionLine), `src/app/records/[id]/page.tsx` | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-12 | Зміна погодженого запису | `src/lib/leave/employee-record.ts` (changeHours, cancelRecord), `src/app/records/[id]/actions.ts`, `src/app/records/[id]/employee-actions.tsx` | `src/lib/leave/employee-record.test.ts` | реалізовано |
| AC-DECIDE-16 | Працівник змінює години до рішення | `src/lib/leave/employee-record.ts` (changeHours, cancelRecord), `src/app/records/[id]/actions.ts`, `src/app/records/[id]/employee-actions.tsx` | `src/lib/leave/employee-record.test.ts` | реалізовано |
| AC-DECIDE-13 | Скасування запису на розгляді | `src/lib/leave/employee-record.ts` (changeHours, cancelRecord), `src/app/records/[id]/actions.ts`, `src/app/records/[id]/employee-actions.tsx` | `src/lib/leave/employee-record.test.ts` | реалізовано |
| AC-DECIDE-17 | Скасування повернутого запису | `src/lib/leave/employee-record.ts` (changeHours, cancelRecord), `src/app/records/[id]/actions.ts`, `src/app/records/[id]/employee-actions.tsx` | `src/lib/leave/employee-record.test.ts` | реалізовано |
| AC-DECIDE-20 | Менеджер бачить коментар працівника | `src/lib/leave/decision.ts` (getRecord), `src/app/records/[id]/page.tsx` | `src/lib/leave/decision.test.ts` | реалізовано |
| AC-DECIDE-21 | Зміна типу відпустки заборонена | `src/lib/leave/employee-record.ts` (changeHours, cancelRecord), `src/app/records/[id]/actions.ts`, `src/app/records/[id]/employee-actions.tsx` | `src/lib/leave/employee-record.test.ts` | реалізовано |
| AC-DECIDE-22 | Зміна годин із перетином | `src/lib/leave/employee-record.ts` (changeHours, cancelRecord), `src/app/records/[id]/actions.ts`, `src/app/records/[id]/employee-actions.tsx`, `supabase/migrations/20261021041722_leave_no_overlap.sql` | `src/lib/leave/employee-record.test.ts` | реалізовано |
| AC-DECIDE-23 | Відхилення з коментарем | `src/lib/leave/supabase-repository.ts` (listRecords: managerComment), `src/app/leave/page.tsx`, `supabase/migrations/20261025090000_leave_decisions.sql` (leave_decisions_select) | `tests/db/leave-decision.test.ts` | реалізовано |
| AC-DECIDE-24 | Погодження з коментарем | `src/lib/leave/supabase-repository.ts` (listRecords: managerComment), `src/app/leave/page.tsx`, `supabase/migrations/20261025090000_leave_decisions.sql` (leave_decisions_select) | `src/lib/leave/use-cases.test.ts` | реалізовано |
| AC-BALANCE-01 | Початкові баланси | `src/lib/leave/balance.ts` (balancesForYear), `src/app/balances/page.tsx`, `src/app/balances/balance-view.tsx` | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-02 | Погоджений цілий день | `src/lib/leave/balance.ts` (recordMinutes, usageByYear) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-03 | Частина дня | `src/lib/leave/balance.ts` (recordMinutes, usageByYear) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-05 | Дві посади в одну дату | `src/lib/leave/balance.ts` (usageByYear) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-06 | Цілий день лише додаткової посади | `src/lib/leave/balance.ts` (usageByYear) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-04 | Запис на розгляді не зменшує баланс | `supabase/migrations/20261027090000_leave_balance.sql` (employee_balance_inputs: лише схвалені) | `tests/db/leave-balance.test.ts` | реалізовано |
| AC-BALANCE-07 | Відхилений запис не зменшує баланс | `supabase/migrations/20261027090000_leave_balance.sql` (employee_balance_inputs), `src/lib/leave/decide-balance.ts` | `src/lib/leave/decide-balance.test.ts`, `tests/db/leave-balance.test.ts` | реалізовано |
| AC-BALANCE-08 | Перевищення залишку на цілий день | `src/lib/leave/balance.ts` (requestWarning), `src/app/leave/actions.ts` (previewLeaveRequest), `src/app/leave/new/new-leave-form.tsx` | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-15 | Перевищення залишку частиною дня | `src/lib/leave/balance.ts` (requestWarning), `src/app/leave/actions.ts` (previewLeaveRequest) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-17 | Одне попередження для заявки на кілька дат | `src/lib/leave/balance.ts` (requestWarning), `src/app/leave/actions.ts` (previewLeaveRequest) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-09 | Попередження менеджеру | `src/lib/leave/balance.ts` (suggestSplit), `src/app/records/[id]/page.tsx` (balance-warning) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-14 | Залишок після попереднього погодження | `src/lib/leave/balance.ts` (suggestSplit, balancesOn) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-10 | Погодження із запропонованим розподілом | `src/lib/leave/decide-balance.ts` (decideWithBalance), `src/app/records/[id]/decision-form.tsx`, `supabase/migrations/20261027090000_leave_balance.sql` (private.decide_leave_record) | `src/lib/leave/decide-balance.test.ts`, `tests/db/leave-balance.test.ts`, `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-18 | Запис із розподілом лишається одним | `src/lib/leave/balance.ts` (splitText), `src/lib/leave/supabase-repository.ts` (listRecords: split), `src/app/leave/page.tsx` | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-19 | Розподіл при нульовому залишку | `src/lib/leave/balance.ts` (planApproval, splitText), `supabase/migrations/20261027090000_leave_balance.sql` | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-16 | Спроба погодити без розподілу | `src/lib/leave/decide-balance.ts` (decideWithBalance), `src/lib/leave/balance.ts` (planApproval) | `src/lib/leave/decide-balance.test.ts`, `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-11 | Перенесення залишку Sick leave | `src/lib/leave/balance.ts` (balancesForYear) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-12 | Менеджер без посад працівника | `supabase/migrations/20261027090000_leave_balance.sql` (private.employee_balance_inputs), `src/lib/leave/decide-balance.ts` | `src/lib/leave/decide-balance.test.ts`, `tests/db/leave-balance.test.ts` | реалізовано |
| AC-BALANCE-13 | Працівник не бачить чужих балансів | `supabase/migrations/20261027090000_leave_balance.sql` (private.employee_balance_inputs), `src/app/balances/[id]/page.tsx` | `tests/db/leave-balance.test.ts` | реалізовано |
| AC-BALANCE-20 | Менеджер додаткової посади бачить повний баланс | `supabase/migrations/20261027090000_leave_balance.sql` (private.employee_balance_inputs), `src/app/balances/page.tsx` | `tests/db/leave-balance.test.ts` | реалізовано |
| AC-BALANCE-21 | Пізнє погодження за минулий рік | `src/lib/leave/balance.ts` (schoolYearOf, balancesForYear) | `src/lib/leave/balance.test.ts` | реалізовано |
| AC-BALANCE-22 | Заявка на два навчальні роки | `src/lib/leave/balance.ts` (schoolYearOf, usageByYear) | `src/lib/leave/balance.test.ts` | реалізовано |
