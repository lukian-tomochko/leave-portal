# Дизайн: рішення менеджера щодо записів відпустки (вимога 02)

## Контекст

- Специфікація: `openspec/specs/leave-decision/spec.md` (AC-DECIDE-01…24). Стек і правила — `AGENTS.md`; модель записів —
  `docs/decisions/0001-model-leave-entries.md`; дизайн-система — `DESIGN.md`, ADR 0002; секретний ключ — ADR 0003.
- Є таблиці `positions`, `position_managers`, `schedule_blocks`, `leave_requests`, `leave_records`; працівник читає лише
  власні записи, менеджер записів поки не бачить; `leave_records` змінювати не можна ні кому (немає `grant update`).
- Домен — чисті функції в `src/lib/leave/` із портом `LeaveRepository`, тести без бази. Права й атомарність рішень
  (одночасні рішення двох менеджерів, AC-DECIDE-07) потребують бази, тому для них додаємо тести на PGlite (справжній
  Postgres у процесі Vitest, без Docker) і функції Postgres.
- Усі дати й час київські; час рішення зберігаємо до хвилини (припущення PM).

## Рішення

### D1. Рішення, зміна годин і скасування — функції Postgres, а не прямі `update`

(AC-DECIDE-02…13, 16, 17, 21.) `leave_records` не отримує `grant update` для `authenticated` ні в якій колонці: статус,
години, власник і посада змінюються лише функціями, які першим рядком перевіряють роль і право на запис.

- `private.decide_leave_record(p_record_id, p_decision, p_comment)` — `security definer`, `set search_path = ''`.
- `private.update_leave_record_hours(p_record_id, p_starts_at, p_ends_at)` — лише власник запису.
- `private.cancel_leave_record(p_record_id)` — лише власник запису.
- Для застосунку — тонкі обгортки `public.*` (`security invoker`), `grant execute` лише `authenticated`.

Альтернатива: `grant update (status)` + політика `update` з умовами. Відхилено: умови «менеджер не вирішує власне»,
«лише з `awaiting_decision`», «коментар обов'язковий для повернення» довелося б розкласти на політику, тригер і `with check`,
а атомарний запис рішення в журнал не гарантувався б. Альтернатива: Server Action з admin-клієнтом. Відхилено: admin-клієнт
обходить RLS і ADR 0003 забороняє його без потреби. Рішення — кандидат у ADR 0004.

### D2. Журнал рішень `leave_decisions`

(AC-DECIDE-05, 10, 15, 23, 24.) Нова таблиця: `id`, `record_id → leave_records`, `decided_by → profiles`, `decision`
(`approved` / `rejected` / `returned_for_revision`), `comment`, `decided_at` (з точністю до хвилини). Рядок додає лише
функція D1. Один запис може мати кілька рішень (повернули, виправили, схвалили): історія — це всі рядки. Хто ухвалив
рішення, видно з `decided_by`, тож адміністратор, який не є менеджером посади, потрапляє в журнал як адміністратор
(AC-DECIDE-10). Коментар менеджера показуємо працівникові з останнього рішення запису.

### D3. Хто що бачить: нові політики читання

(AC-DECIDE-01, 08, 14, 20.) Політики `select` (окремо на кожну операцію, `to authenticated`):

| Таблиця | Хто читає |
|---|---|
| `leave_records` | власник; відповідальний менеджер посади (`private.manages_position(position_id)`); адміністратор |
| `leave_requests` | власник; менеджер, який відповідає за посаду хоча б одного запису заявки (нова `private.manages_request(id)`); адміністратор |
| `leave_decisions` | ті, хто бачить сам запис (`private.can_see_record(record_id)`) |
| `profiles` | менеджер бачить профіль працівника своєї посади (`private.manages_employee(id)`); працівник і відповідальний менеджер бачать профіль автора рішення лише для рішення запису, який вони бачать (`private.sees_decider(id)` через `private.can_see_record(record_id)`), щоб показати «хто вирішив» (AC-DECIDE-15). Загального доступу до профілів немає |

Менеджер не бачить записів інших посад, навіть того самого працівника (AC-DECIDE-01). Нові хелпери — у схемі `private`,
`security definer`, `set search_path = ''`.

### D4. Правила рішення

(AC-DECIDE-04, 07, 08, 09, 10, 18, 19.) Порядок перевірок у `decide_leave_record`:

1. немає сесії — помилка; роль не `manager` і не `admin` — відмова без запису (AC-DECIDE-09);
2. запис читається **без блокування** (лише власник і посада, які не змінюються ніколи): запису немає серед видимих —
   відмова (чужого запису не «знаходимо»);
3. менеджер не відповідальний за посаду — відмова (AC-DECIDE-08); адміністратор може будь-який запис (AC-DECIDE-10);
4. менеджер і власник запису одна особа — відмова «own record»; власні записи вирішує лише адміністратор (AC-DECIDE-18,
   AC-DECIDE-19);
5. **лише тепер блокуємо рядок** (`select … for update`) і перевіряємо статус: він уже не `awaiting_decision` — не помилка
   прав: функція повертає поточний статус, а застосунок показує «Another manager has already decided: <статус>»
   (AC-DECIDE-07); `rejected` і `cancelled` кінцеві; два одночасні рішення виконуються по черзі;
6. повернення без коментаря — відмова з кодом; застосунок перевіряє це наперед і показує «Tell the employee what to fix»
   (AC-DECIDE-04);
7. оновлення статусу й запис у журнал — в тій самій транзакції, під тим самим блокуванням.

Права перевіряються до блокування, щоб сторонній менеджер не міг притримати блокуванням чужий запис.

Адміністратор, який вирішує власний запис, дозволений (PM: власні записи вирішує адміністратор); це питання до PM, якщо
адмін сам собі менеджер.

### D5. Працівник: лише години й скасування

(AC-DECIDE-06, 12, 13, 16, 17, 21, 22.) `update_leave_record_hours` змінює години лише власного запису зі статусом
`awaiting_decision` або `returned_for_revision`; зі статусу `returned_for_revision` запис переходить у `awaiting_decision`
(повторне подання, AC-DECIDE-06). Для `approved` (AC-DECIDE-12) та інших статусів повертає поточний статус без зміни.
Перетин із іншими записами тієї ж посади перевіряє застосунок наперед (повідомлення PM, AC-DECIDE-22), а обмеження
`leave_records_no_overlap` страхує від гонки; саму себе обмеження не рахує. Тип відпустки, дату й посаду працівник
не змінює: `leave_requests` без `grant update`, а застосунок показує повідомлення PM (AC-DECIDE-21).
`cancel_leave_record` — лише власник, лише з `awaiting_decision` чи `returned_for_revision`; `cancelled` кінцевий
(AC-DECIDE-13, 17).

Функція рішення спершу перевіряє права, потім блокує рядок запису (`select … for update`) і лише тоді перевіряє статус; функції
працівника блокують лише власний рядок (`where id = … and employee_id = auth.uid()`) і потім перевіряють статус. Рішення менеджера
не може вклинитися між перевіркою статусу й зміною годин чи скасуванням: другий виклик побачить уже новий статус і
поверне його без змін. Тест цього порядку — послідовний (AC-DECIDE-07, AC-DECIDE-12, AC-DECIDE-17): PGlite працює в одній
сесії, тож справжню паралельність двох транзакцій на ньому перевірити не можна. Гарантія тут — блокування рядка в
конструкції функцій, а не конкурентний тест; на це є рядок у ризиках.

## UI і компоненти

Компоненти лише з `@/components/ui`, кольори лише з токенів `DESIGN.md`; тексти повідомлень дослівно з AC.

- **`/decisions`** («Awaiting decision», менеджер і адміністратор): `Table` (працівник, посада, дата, години, тип
  відпустки, коментар), кнопка «Відкрити» → запис. Порожній стан — «No records awaiting decision» (AC-DECIDE-14).
- **`/decisions/history`** («History»): `Table` вирішених записів менеджера з `Badge` статусу (AC-DECIDE-11).
- **`/records/[id]`** — сторінка запису для всіх ролей: працівник, посада, дата, години, тип, коментар працівника
  (AC-DECIDE-20), коментар менеджера, історія рішень рядками «дата й час, хто вирішив, рішення» (AC-DECIDE-15).
  - Менеджер/адміністратор бачить форму рішення: `Textarea` коментаря та три `Button` (Approve, Reject, Return for
    revision); підтвердження перед Approve і Reject — через `Dialog`, бо рішення остаточні (PM: на розсуд розробника).
  - Власник бачить поле годин, кнопку «Зберегти» й «Скасувати запис», коли статус дозволяє.
- **Помилки й попередження**: помилка дії — `Alert variant="destructive"` («Tell the employee what to fix»,
  «Your own record is decided by an administrator», «This record is already approved and cannot be changed»,
  «Another manager has already decided: Approved», «Only the hours can be changed…», «You already have a request for this
  time: …»). Нічого з цього не попередження, тож `warning` не використовуємо.
- **«My requests»** (`/leave`): додаємо колонку «Manager comment» і посилання на `/records/[id]`; статус — `Badge`.
- **Шапка**: пункт «Рішення» (`/decisions`) лише для ролей `manager` і `admin`: це UX, права перевіряють сторінки й база.
- Порожній стан без даних і для працівника без рішень — текст `text-muted-foreground`, як у «My requests».

## Дані й RLS

Усі таблиці в `public`: `enable row level security`, `revoke all … from anon, authenticated`, явні `grant`, політика на кожну
операцію `to authenticated` з `(select auth.uid())`.

- **`leave_decisions`** (D2): `grant select` лише `authenticated`; `insert`/`update`/`delete` для `authenticated` немає
  (політик на них теж немає, рядок додає функція D1 як `security definer`). Політика `select`: `private.can_see_record(record_id)`.
- **`leave_records`**: політика `select` розширена (D3); `insert` без змін (працівник створює лише власні, лише
  `awaiting_decision`). `update` і `delete` для `authenticated` — немає: **column grants** тут порожні свідомо, жодна
  колонка (`status`, `employee_id`, `position_id`, години) не змінюється напряму. Змінюють лише функції D1.
- **`leave_requests`**: `select` розширений менеджером (D3); `update` для `authenticated` немає, тож працівник не змінює
  `leave_type` чи `comment` (AC-DECIDE-21).
- **`profiles`**: додаткова політика `select` для менеджера (D3); `grant update (full_name)` і політика `update` лишаються
  як є, `role` для користувача незмінна (стартова міграція).
- **Функції** (D1): `private.*` — `security definer`, `set search_path = ''`, `revoke execute … from public, anon`,
  `grant execute … to authenticated`; `public.*` — `security invoker`, `grant execute` лише `authenticated`.
- **Набір ролей не змінюємо** (лишається `employee`/`manager`/`admin`), тож міграції drop-first не потрібні.
- **Тестові дані** для PM: `pm-employee@`, `pm-manager@`, `pm-admin@example.test` у `supabase/demo-users.json` і в
  `supabase/seed.sql` (посада, менеджер), паролі лише в чаті команди.

## Auth

- Proxy (`src/proxy.ts`) лише відправляє на `/login`: це UX, а не захист.
- **Кожна Server Action** (`decideLeaveRecord`, `updateLeaveRecordHours`, `cancelLeaveRecord`) і кожна сторінка зрізу
  починаються з `getClaims()`; без claims — `redirect("/login")` без запису. Роль читається з `public.profiles` за
  `claims.sub`, ніколи з `user_metadata`. Для рішень роль перевіряє й функція бази (D4): права не залежать від того,
  що показала сторінка чи прихована кнопка.
- Записи виконуємо **клієнтом користувача** (діють RLS і GRANT), через `supabase.rpc`. **Admin-клієнт
  (`SUPABASE_SECRET_KEY`) не потрібен**: усе робить функція бази з перевіркою ролі всередині (ADR 0003).
- Id запису з форми не довіряємо: функція перевіряє, що користувач його бачить і має право на дію.
- Сторінки `/decisions*` дозволяють лише `manager` і `admin`: працівник без цих ролей бачить відмову без даних.

## Ризики й питання

- Адміністратор як власний менеджер і адміністратор, який вирішує власний запис: PM тексту не дав; дозволяємо за
  правилом «власні записи вирішує адміністратор».
- «Підтвердження перед Approve і Reject» — рішення розробника ([#17](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/17)).
- Перетин годин при зміні (AC-DECIDE-22) пре-валідує застосунок, база страхує обмеженням (гонка).
- Справжньої паралельності транзакцій на PGlite не перевірити (одна сесія): атомарність рішень тримається на `for update` у
  функціях і перевіряється послідовними тестами; конкурентний тест додамо, якщо з'явиться тестова база з кількома з'єднаннями.
