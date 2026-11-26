# Дизайн: шкільний календар (вимога 04) і AC-LEAVE-22

## Контекст

- Специфікація: `openspec/specs/school-calendar/spec.md` (AC-CAL-01…15), нові вимоги в `leave-request` і `leave-balance`
  (AC-CAL-03…06), уточнення `leave-request` (AC-LEAVE-22). Правила стеку — `AGENTS.md`; модель записів — ADR 0001;
  функції замість прямих `update` — ADR 0004; баланс у застосунку — ADR 0005; дизайн-система — `DESIGN.md`, ADR 0002.
- Блоки розкладу в одному місці: `schedule.ts:blocksOn` (заявка, `validateHours`, `checkChange`) і приватна копія в
  `balance.ts`. БД теж перевіряє години за розкладом у `private.create_leave_request_impl` і
  `private.update_leave_record_hours`, але закриттів не знає.
- Дати й час київські, без перерахунку поясів (`date` і `time` без зони); навчальний рік 1.09–31.08 (`schoolYearOf`).
- Робочі припущення до відповіді PM на питання #22–#24 — у `docs/spec-reading.md` (розділ зрізу 3).

## UI і компоненти

### D1. Дві сторінки: `/calendar` для всіх і `/calendar/manage` для адміністратора

(AC-CAL-01, 02, 09, 12, 14, 15.) `/calendar?year=2026` показує закриття навчального року, що починається в цьому році, за
датами; рік за замовчуванням обчислює `schoolYearOf(todayInKyiv())`; посилання «попередній/наступний рік». Закриття, що
перетинає 31.08, потрапляє в обидва роки (перетин діапазону з вікном року). Порожній рік — повідомлення
«No closed days in school year 2026–2027» (AC-CAL-15). Скорочений день показується як «Teachers' meeting — 2026-11-20 з 12:00».
Гостя на `/calendar` перенаправляє наявний захист на `/login` без даних (AC-CAL-14).

`/calendar/manage` — форма (назва, перемикач «Цілі дні / Скорочений день», дата початку й кінця, для скороченого дня
дата й час із кроком 300 с) і список закриттів з кнопкою «Видалити» у `Dialog` підтвердження (остаточна дія, як в
рішеннях менеджера). Не-адмін бачить `Alert` із «Only an administrator can change the school calendar» без форми
(AC-CAL-12). Чому окрема сторінка: гейт ролі, як `/decisions`, не змішується зі сторінкою, яку бачать усі.

### D2. Повідомлення — у `messages.ts`, лише дослівні з AC

(AC-CAL-03, 07, 10, 11, 12, 15.) Нові константи й функції: `schoolClosedOn(name)`, `closureBlocked(records)`,
`alreadyClosed(overlaps)`, `END_BEFORE_START`, `ONLY_ADMIN_CALENDAR`, `noClosuresInYear(label)`. Для некоректної назви
й часу PM тексту не дав (питання #24): нейтральні українські фрази, які не вигадуємо англійською.

### D3. Закриття в заявці: відкинути дату з повідомленням, решта лишається

(AC-CAL-03, 04, 05, 09.) `planRequest` бере відкриті блоки (`openBlocks`) замість сирих: цілий день — блоки до часу
закриття (AC-CAL-04), години перевіряє `validateHours(openBlocks, …)` із повідомленням про незакриті блоки (AC-CAL-05),
дата, у якої не лишилось відкритих блоків, відкидається в `skippedClosed` із назвою закриття, як дата без годин
(AC-LEAVE-21); день без розкладу лишається `NO_WORKING_HOURS`. Форма показує закриту дату одразу після вибору (AC-CAL-03).

## Дані й RLS

### D4. Таблиця `school_closures` і читання для всіх авторизованих

(AC-CAL-01, 02, 15.) Колонки: `id`, `name` (1–100 символів), `starts_on`, `ends_on` (`ends_on ≥ starts_on`), `closed_from time`
(NULL — цілий день; інакше `starts_on = ends_on` і час кратний 5 хв), `created_by`, `created_at`. RLS увімкнено;
`revoke all` від `anon` і `authenticated`; `grant select` для `authenticated` з однією політикою `(select auth.uid()) is not null`.
Гість не читає нічого (AC-CAL-14). Insert/update/delete не видаємо нікому.

### D5. Запис — функції `private.add_school_closure` і `private.remove_school_closure`

(AC-CAL-01, 07, 08, 09, 10, 11, 13.) Перший рядок — перевірка входу й ролі `admin` через `private.current_app_role()`;
інакше `42501 forbidden`, нічого не змінено (AC-CAL-13). Бізнес-відмови повертаємо `jsonb` із кодом і даними без текстів
(`name_empty`, `name_too_long`, `end_before_start`, `overlap` зі списком `{date,name}`, `blocked` зі списком
`{date,email}`), тексти — у `messages.ts`. Порядок перевірок (рішення розробника, PM порядок не задав): назва й час,
кінець не раніше початку, перетин, записи, що блокують. Записи блокують у статусах `awaiting_decision`,
`returned_for_revision`, `approved`; `rejected` і `cancelled` ні (AC-CAL-07, 08); для скороченого дня лише записи з
хвилинами після часу закриття. `pg_advisory_xact_lock` у функції додавання й `…_shared` у функціях створення
запису/зміни годин закривають гонку «додали закриття» проти «створили запис». Страхує від паралельного перетину
обмеження виключення `exclude using gist (daterange(starts_on, ends_on, '[]') with &&)` (AC-CAL-11). Для застосунку —
обгортки `public.*` (`security invoker`), `grant execute` лише `authenticated`.

### D6. БД не створює запис на закритий день

(AC-CAL-03, 04, 05.) `private.create_leave_request_impl` і `private.update_leave_record_hours` рахують «ефективні блоки»
(блоки розкладу мінус закрита частина дня) через спільну `private.closed_from(date)`: пряма заявка в обхід сторінок на
закритий день відхиляється так само, як годину поза розкладом. Той самий рядок виправляє AC-LEAVE-22: кінець відпустки
може дорівнювати початку наступного ефективного блоку, рахуються лише хвилини всередині блоків.

### D7. Баланс читає закриття в застосунку, функцію `employee_balance_inputs` не змінюємо

(AC-CAL-06.) Баланс рахує TS (ADR 0005). `BalanceInputs` отримує `closures`, а `loadBalanceInputs` читає
`school_closures` напряму (дозволено `select`). Приватну копію `blocksOn` у `balance.ts` прибираємо: і `workingMinutes`,
і `recordMinutes` беруть `openBlocks`, тож частка дня — хвилини ÷ незакриті робочі хвилини (210/210 = 1.00).

## Auth

### D8. Кожна дія й сторінка перевіряють вхід і роль на сервері

(AC-CAL-12, 13, 14.) Server Actions додавання й видалення: `supabase.auth.getClaims()` → `loadActor` (роль із `profiles`,
не з `user_metadata`) → `isAdmin` до виклику функції; відмова повертає `ONLY_ADMIN_CALENDAR`. Сторінка `/calendar/manage`
має той самий гейт. Пункт «Керувати календарем» у шапці лише для `admin` (`adminOnly` у `nav-links.tsx`), «Календар» — для всіх.
Пряму спробу в обхід сторінок (AC-CAL-13) зупиняє `42501` у базі, а не інтерфейс.

## Ризики й поза межами

- PM не відповів на #22–#24: робочі варіанти в журналі; зміна відповіді PM — `clarify-school-calendar`.
- UAT-записи у спільний прод: прибирання за собою, AC, що не вдасться безпечно довести, — «Не перевірено».
- Поза межами: дизайн-анімації (окремий напрям, не AC), зміна закриття, повторювані закриття (див. proposal).
