# QA proof pack: зріз 2 — рішення менеджера й баланс (leave-portal)

<!--
Шаблон з koldovsky/2026-quitcode-08-quality-hw/materials/templates/proof-pack.template.md.
Заповнюється по кроках WS8 (A → B → C → D). Посилання — на файли на коміті (…/blob/<SHA>/…#L<N>), на PR і на прогони.
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
Цей файл — вхід для конвеєра WS9: на кожен AC видно, чим він доведений.
-->

- Прод-URL: https://leave-portal-blush.vercel.app
- Вимоги: Вимоги: https://github.com/mkozlovskyi-ops/course-staff-management-spec · джерело: docs · знімок 2026-10-24
- `/api/health` на момент UAT: заповнюється на кроці C

## 3 AC

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-BALANCE-13 | відмова в браузері (чужі дані): працівник відкриває баланс іншого працівника | "Then the balances are not shown." |
| AC-DECIDE-14 | стан інтерфейсу (порожній стан): менеджер без записів, що чекають рішення | "Then the manager sees the message "No records awaiting decision"." |
| AC-BALANCE-01 | базовий сценарій, лише читання: працівник без погоджених записів дивиться свої баланси | "Then the employee sees: "Sick leave" — granted 18.00, used 0.00, remaining 18.00; "Personal leave" — granted 18.00, used 0.00, remaining 18.00; "Unpaid leave" and "Family celebration" — used 0.00 only." |

Додатково доведено мутацією (без UAT-запису):
- AC-DECIDE-08 (менеджер чужої посади не вирішує запис): його «Тоді» («the status does not change, and the decision is not saved») невидиме в браузері, тож UAT-записом його не довести; правило в базі доведено SQL-мутантом нижче.
- AC-DECIDE-12 (зміна годин схваленого запису): UAT-доказ потребує схваленого запису, тобто запису в спільний прод, а прибирання за собою для цього AC ми не будували; тому він доведений тестами бази, unit-тестом і мутантами S2 та ручним.

## A. Ворота

- PR воріт: https://github.com/lukian-tomochko/leave-portal/pull/36
- Зелений `quality` на `main`: https://github.com/lukian-tomochko/leave-portal/actions/runs/41413581234
- Обов'язкові перевірки в `solo-main`: додає власник у Settings → Rules (див. файл здачі)

Розбір першого повного прогону `fallow` (той самий — в описі PR воріт):

| Група знахідок | Скільки | Справжня / навмисна / хибна | Дія і причина |
|---|---|---|---|
| Невикористаний файл `src/lib/supabase/client.ts` | 1 | справжня, навмисна | `ignorePatterns` з причиною: браузерний клієнт із шаблону, уся робота з базою — із сервера |
| Невикористаний файл `src/components/ui/select.tsx` | 1 | справжня | `ignorePatterns` з причиною: компонент дизайн-системи, видаляти — окреме рішення |
| Невикористаний експорт `AC_ID_GLOBAL` у `scripts/lib/spec-lib.mjs` | 1 | справжня, скрипт шаблону | `ignoreExports` з причиною: файл шаблону не змінюємо |
| Дублі коду | 7 груп | лишено | `fallow audit` валить лише нові дублі |
| Складність | 39 функцій | справжня | лишено: `new-only`, рефакторинг окремо |

## B. Якість тестів

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-BALANCE-13 | функція бази `private.employee_balance_inputs` (обгортка `public.employee_balance_inputs`), `supabase/migrations/20261027090000_leave_balance.sql`; сторінка `src/app/balances/[id]/page.tsx` лише показує відмову | база (PGlite) + e2e | «Хто не може» — правило даних: відмову дає база, а не TS-копія; те, що людина бачить, доводить e2e | `tests/db/leave-balance.test.ts` (рядок 93), UAT — крок C |
| AC-DECIDE-14 | TS: `awaitingEmptyMessage` у `src/lib/leave/decision.ts`; показує `src/app/decisions/page.tsx` | unit + e2e | Вибір тексту порожнього стану — чиста функція; те, що текст видно на сторінці, доводить e2e | `src/lib/leave/decision.test.ts` (рядок 116), UAT — крок C |
| AC-BALANCE-01 | TS: `balancesForYear` (`GRANTED_CENTS`, залишок = надано + перенесено − використано) у `src/lib/leave/balance.ts`; таблицю показує `src/app/balances/balance-view.tsx` | unit + e2e | Розрахунок — чиста функція без бази; те, що рядки й числа видно людині на сторінці, доводить e2e | `src/lib/leave/balance.test.ts` (рядок 85), UAT — `tests/e2e/balances.spec.ts` |
| AC-DECIDE-12 (додатково) | SQL: `private.update_leave_record_hours` (перелік дозволених статусів), `supabase/migrations/20261026080000_leave_hours_in_schedule.sql`; TS: `changeHours` і `statusRefusal` у `src/lib/leave/employee-record.ts` (текст PM) | база (PGlite) + unit + e2e | Дані не змінилися — перевіряє база; повідомлення PM підбирає TS; обидва видно на сторінці запису | `tests/db/leave-decision.test.ts` (рядок 186), `src/lib/leave/employee-record.test.ts` (рядок 92), UAT — крок C |
| AC-DECIDE-08 (додатково) | SQL: `private.decide_leave_record` (відповідальність за посаду) | база (PGlite) | Права на дію — правило бази; тест `src/lib/leave/decision.test.ts:239` працює на фейку, що повторює правило SQL, тож доводом відмови його не рахуємо | `tests/db/leave-decision.test.ts` (рядок 151) |

### Покриття

| Файл за AC | Рядки | Гілки | Чим доведено, якщо 0 % |
|---|---|---|---|
| `src/lib/leave/decision.ts` | 92 % | 86 % | — |
| `src/lib/leave/employee-record.ts` | 94 % | 84 % | — |
| `src/lib/leave/balance.ts` (підлога 90/85/90/90) | 98 % | 94 % | — |
| `src/lib/leave/messages.ts` | 100 % | — | — |
| `src/app/decisions/page.tsx`, `src/app/records/[id]/page.tsx`, `src/app/balances/[id]/page.tsx` | 0 % | 0 % | e2e (UAT, крок C) і тести бази; сторінки лише показують те, що вирішили функції бази та домен |
| правила в SQL (`decide_leave_record`, `update_leave_record_hours`, `employee_balance_inputs`) | не міряється v8 | — | тести бази на PGlite + SQL-мутанти нижче |

Поріг на загальний відсоток не ставимо (≈36 %): сторінки й дії доводять тести бази та e2e, а не Vitest.

### Доказ мутацією

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| `src/lib/leave/decision.ts:183` `if (error instanceof DecisionDeniedError)` → `if (true)` (будь-який збій бази видається за відмову в правах) | AC-DECIDE-08 | вижив | `src/lib/leave/decision.test.ts:253` «AC-DECIDE-08: збій бази під час рішення не видається за відмову в правах і не ковтається»: статус лишається `awaiting_decision` (межа з AC), помилка не підміняється | убитий |
| `src/lib/leave/decision.ts:96` `NOT_ALLOWED = "Недостатньо прав…"` → `""` (відмова без жодного пояснення) | AC-DECIDE-08 | вижив | `src/lib/leave/decision.test.ts:239`: додано перевірку, що повідомлення відмови не порожнє | убитий |
| SQL **S1** `supabase/migrations/20261027090000_leave_balance.sql`: прибрано обидві перевірки відповідальності за посаду в `decide_leave_record` | AC-DECIDE-08 | — (SQL-мутант) | `tests/db/leave-decision.test.ts:151`, і варіант з акаунтами PM | KILLED |
| SQL **S2** `20261026080000_leave_hours_in_schedule.sql`: статус `approved` дозволено в `update_leave_record_hours` | AC-DECIDE-12 | — | `tests/db/leave-decision.test.ts:186` | KILLED |
| SQL **S3** `20261027090000_leave_balance.sql`: умова «сам працівник» у `employee_balance_inputs` завжди істинна | AC-BALANCE-13 | — | `tests/db/leave-balance.test.ts:93` (і AC-BALANCE-12) | KILLED |
| ручний, `decision.ts:152` `awaitingEmptyMessage`: `records.length === 0` → `<= 1` (межа «0 записів» з AC) | AC-DECIDE-14 | — | `decision.test.ts:116` | убитий |
| ручний, `employee-record.ts` `statusRefusal`: `status === "approved"` → `"rejected"` | AC-DECIDE-12 | — | `employee-record.test.ts:92` | убитий |
| ручний, `balance.ts:19` `GRANTED_CENTS = 1800` → `1700` (межа «granted 18.00» з AC) | AC-BALANCE-01 | — | `balance.test.ts:85` (і ще 4 тести балансу) | убитий |
| ручний, `balance.ts`: `personal.granted: toDays(GRANTED_CENTS)` → `toDays(0)` | AC-BALANCE-01 | — | `balance.test.ts:85` | убитий |
| ручний, `balance.ts`: `unpaid: { used: toDays(used.unpaid) }` → `toDays(used.family)` («Unpaid leave» — лише використано) | AC-BALANCE-01 | — | `balance.test.ts` AC-BALANCE-05, 10, 19 | убитий |

- Stryker (`npm run mutation:ts -- --mutate <файл>`): `decision.ts` 74,82 % → 76,26 % (вижилих 16 → 14, убито на 2 більше); `employee-record.ts` 84,40 %, на рядках AC-DECIDE-12 (`statusRefusal`, перевірка статусу в `checkChange`) вижилих немає: вижили лише `overlaps` (межа перетину годин — AC-DECIDE-22, не наш AC), гонка (рядок 117) і нейтральний текст `RECORD_NOT_EDITABLE`. Рядки AC-DECIDE-14 (`awaitingEmptyMessage`) без вижилих.
- Stryker на `balance.ts` (AC-BALANCE-01): 84,46 %, на рядках початкових значень (`GRANTED_CENTS`, надано / використано / залишок) вижилих немає. Вижили мутанти на перенесенні **Personal leave** в наступний рік (рядки 140 і 161) та на розподілі «Personal/Unpaid» (AC-BALANCE-08–10): це поза текстом AC-BALANCE-01, а вимога PM про перенесення Personal leave не описана, тож тест на неї не вигадуємо.
- SQL-мутації (`npm run mutation:sql`): 3 з 4 вбито (S1, S2, S3), 1 еквівалентний прийнято (S1b), 75 %.
- Еквівалентні мутанти: **S1b** — друга перевірка відповідальності за посаду в `decide_leave_record` (після `for share`) еквівалентна першій (перед блокуванням): перша вже відхиляє менеджера чужої посади, друга лише фіксує призначення блокуванням. Тому S1 знімає обидві одразу.

## C. UAT на проді

Специфікації (Playwright, лише читання, тег `@uat`, «Тоді» дослівно з AC PM):

| AC | Специфікація | Роль | Дані |
|---|---|---|---|
| AC-BALANCE-01 | `tests/e2e/balances.spec.ts` | teacher2@example.test (працівник без записів) | лише читання |
| AC-BALANCE-13 | `tests/e2e/balances.spec.ts` | teacher1@example.test; адресу сторінки балансу teacher2 бере manager1 | лише читання |
| AC-DECIDE-14 | `tests/e2e/decisions.spec.ts` | manager2@example.test (відповідає лише за додаткову посаду teacher1, записів немає) | лише читання |

Негативний контроль: `tests/e2e/negative-controls.spec.ts` (NC-1: хибний текст у перевірці → очікуємо FAIL; NC-2: інший текст AC при тих самих перевірках → очікуємо NEEDS-HUMAN).

Результати прогону на проді (`npm run uat -- --url https://leave-portal-blush.vercel.app`): **заповнюються після запуску власником** (потрібні паролі акаунтів і вхід рецензента в його терміналі).

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-BALANCE-01 | `tests/e2e/balances.spec.ts` | — | — | — | — |
| AC-BALANCE-13 | `tests/e2e/balances.spec.ts` | — | — | — | — |
| AC-DECIDE-14 | `tests/e2e/decisions.spec.ts` | — | — | — | — |

- Звіт: `docs/qa/uat/<YYYY-MM-DD>/report.md` — після прогону
- Відео: вкладення в описі PR зі звітом
- Негативний контроль: після `npm run uat:nc`
- Дані: лише читання

## D. Eval рецензента

Заповнюється на кроці D.
