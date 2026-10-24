# Дизайн-система: портал відсутностей персоналу школи

- **Джерело:** AI-агент (Claude Code, Claude Sonnet 5.5) за шаблоном `materials/DESIGN.template.md` репо домашки WS7; промпт — в описі PR дизайн-системи. Значення контрасту пораховані скриптом (OKLCH → sRGB → WCAG), а не прикинуті на око.
- **Вхід від PM:** розділу «Вигляд і тон» у `requirements/product.md` немає: PM відповів, що вигляд — на розсуд розробника ([питання #18](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/18)). Тому спираємось на бачення продукту й ролі (`requirements/product.md`) та на три правила PM про зміст, а не стиль:
  - тип відпустки й статус запису **завжди текстом**; колір лише додається, ніколи не замінює текст ([#14](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/14));
  - попередження («запис створено, але зверніть увагу») не має виглядати як помилка («не збережено») ([#16](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/16));
  - «My requests» — список; календар — необов'язкова добавка ([#15](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/15)).
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui); перевірка — `npm run check:design`

## 1. Огляд

Інтерфейс для вчителів, асистентів, менеджерів і адміністратора школи: вони відкривають портал на комп'ютері, щоб подати заявку чи ухвалити рішення за кілька хвилин. Мобільна верстка поза межами продукту (`requirements/product.md`, «Out of scope»). Тон: спокійний, діловий, точний. Уникаємо ігрового й «стартапного» стилю: яскравих градієнтів, емодзі замість слів, кольорових акцентів без змісту. Важливіша щільність, ніж простір: менеджер переглядає список із десятків записів, тож таблиці компактні, а картки лише для груп (форма входу, підсумок заявки). Світла й темна теми за системою (`prefers-color-scheme`), перемикача немає.

## 2. Кольори

Значення — OKLCH. У сторінках лише утиліти з колонки «Клас»: ніколи hex, `bg-[#…]`, сирі палітри (`zinc-500`, `bg-white`) чи колір у `style`. Темна тема діє за системою. Основний колір — глибокий синій (відтінок 255–258), нейтралі злегка підфарбовані тим самим відтінком.

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й основний текст | `oklch(0.985 0.004 250)` / `oklch(0.22 0.03 255)` | `oklch(0.17 0.02 255)` / `oklch(0.95 0.008 255)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | картки, панелі, рядки підсумку | `oklch(1 0 0)` / `oklch(0.22 0.03 255)` | `oklch(0.21 0.022 255)` / `oklch(0.95 0.008 255)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | меню, діалоги | як `card` | як `card` | `bg-popover` |
| `primary` / `primary-foreground` | основна дія (одна на екран) | `oklch(0.42 0.12 258)` / `oklch(0.985 0.004 250)` | `oklch(0.72 0.12 255)` / `oklch(0.17 0.02 255)` | `bg-primary`, `text-primary-foreground` |
| `secondary` / `secondary-foreground` | другорядна дія | `oklch(0.94 0.012 255)` / `oklch(0.27 0.04 255)` | `oklch(0.27 0.025 255)` / `oklch(0.93 0.01 255)` | `bg-secondary` |
| `muted` / `muted-foreground` | приглушене тло, підписи, допоміжний текст | `oklch(0.955 0.008 255)` / `oklch(0.46 0.03 255)` | `oklch(0.25 0.022 255)` / `oklch(0.74 0.025 255)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | наведення, вибраний рядок | `oklch(0.93 0.02 255)` / `oklch(0.27 0.05 255)` | `oklch(0.3 0.04 255)` / `oklch(0.95 0.01 255)` | `bg-accent` |
| `destructive` / `destructive-foreground` | помилка («не збережено»), небезпечна дія | `oklch(0.5 0.2 27)` / `oklch(0.985 0 0)` | `oklch(0.72 0.17 25)` / `oklch(0.17 0.02 255)` | `text-destructive`, `bg-destructive` |
| `warning` / `warning-foreground` | попередження («збережено, але зверніть увагу») | `oklch(0.96 0.06 90)` / `oklch(0.38 0.08 70)` | `oklch(0.3 0.06 85)` / `oklch(0.88 0.1 90)` | `bg-warning`, `text-warning-foreground` |
| `overlay` | затемнення за діалогом | `oklch(0 0 0 / 10%)` | `oklch(0 0 0 / 50%)` | `bg-overlay` |
| `border` | розділювачі, межі карток і таблиць | `oklch(0.9 0.01 255)` | `oklch(0.3 0.02 255)` | `border-border` |
| `input` | межа поля вводу | `oklch(0.6 0.02 255)` | `oklch(0.55 0.03 255)` | `border-input` |
| `ring` | кільце фокусу | `oklch(0.55 0.15 258)` | `oklch(0.68 0.13 255)` | `ring-ring` |
| `status-awaiting` | запис «Awaiting decision» | `oklch(0.95 0.06 90)` / `oklch(0.38 0.08 70)` | `oklch(0.3 0.06 85)` / `oklch(0.88 0.1 90)` | `bg-status-awaiting`, `text-status-awaiting-foreground` |
| `status-approved` | запис «Approved» | `oklch(0.94 0.06 150)` / `oklch(0.36 0.09 150)` | `oklch(0.3 0.06 150)` / `oklch(0.86 0.1 150)` | `bg-status-approved`, `text-status-approved-foreground` |
| `status-rejected` | запис «Rejected» | `oklch(0.94 0.05 25)` / `oklch(0.42 0.16 27)` | `oklch(0.3 0.07 25)` / `oklch(0.86 0.09 25)` | `bg-status-rejected`, `text-status-rejected-foreground` |
| `status-returned` | запис «Returned for revision» | `oklch(0.94 0.05 300)` / `oklch(0.4 0.13 300)` | `oklch(0.3 0.07 300)` / `oklch(0.86 0.08 300)` | `bg-status-returned`, `text-status-returned-foreground` |
| `status-cancelled` | запис «Cancelled» | `oklch(0.94 0.005 255)` / `oklch(0.42 0.02 255)` | `oklch(0.28 0.01 255)` / `oklch(0.8 0.02 255)` | `bg-status-cancelled`, `text-status-cancelled-foreground` |

Статусні токени подано як «тло / текст». Статус у інтерфейсі — це `Badge` з текстом статусу (`STATUS_LABELS` у `src/lib/leave/messages.ts`); колір лише підсилює слово.

### Контраст

Порахований скриптом за формулою WCAG 2.x з OKLCH → sRGB. Усі пари проходять норму в обох темах.

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 16.58 | 16.53 | ≥ 4.5 |
| `card-foreground` на `card` | 17.31 | 15.31 | ≥ 4.5 |
| `muted-foreground` на `background` | 6.82 | 8.30 | ≥ 4.5 |
| `muted-foreground` на `card` | 7.11 | 7.69 | ≥ 4.5 |
| `muted-foreground` на `muted` | 6.24 | 6.94 | ≥ 4.5 |
| `primary-foreground` на `primary` | 8.20 | 7.71 | ≥ 4.5 |
| `secondary-foreground` на `secondary` | 12.64 | 12.26 | ≥ 4.5 |
| `accent-foreground` на `accent` | 12.28 | 11.78 | ≥ 4.5 |
| `destructive` на `card` | 6.66 | 6.63 | ≥ 4.5 |
| `destructive` на `background` | 6.38 | 7.16 | ≥ 4.5 |
| `destructive-foreground` на `destructive` | 6.38 | 7.16 | ≥ 4.5 |
| `warning-foreground` на `warning` | 9.03 | 9.54 | ≥ 4.5 |
| `status-awaiting-foreground` на `status-awaiting` | 8.81 | 9.54 | ≥ 4.5 |
| `status-approved-foreground` на `status-approved` | 8.94 | 9.03 | ≥ 4.5 |
| `status-rejected-foreground` на `status-rejected` | 7.36 | 8.66 | ≥ 4.5 |
| `status-returned-foreground` на `status-returned` | 8.04 | 8.93 | ≥ 4.5 |
| `status-cancelled-foreground` на `status-cancelled` | 7.09 | 7.82 | ≥ 4.5 |
| `input` на `card` (межа поля) | 3.94 | 3.66 | ≥ 3 |
| `ring` на `background` (фокус) | 4.71 | 6.63 | ≥ 3 |
| `primary` на `background` (межа кнопки) | 8.20 | 7.71 | ≥ 3 |

## 3. Типографіка

Шрифт — Geist (`next/font`, змінна `--font-geist-sans`, клас `font-sans`, системний запасний шрифт у `--font-sans`). Інтерфейс — українською, а тексти повідомлень із вимог PM лишаються дослівно такими, як у AC (англійською). Дати, години й числа в таблицях — `tabular-nums`.

| Роль | Клас | Де |
|---|---|---|
| Заголовок сторінки | `text-2xl font-semibold` | один `h1` на сторінку |
| Заголовок розділу | `text-lg font-semibold` | `h2` усередині сторінки (наприклад, «Підсумок») |
| Основний текст | `text-sm` | форми, таблиці, списки |
| Підпис, допоміжний текст | `text-sm text-muted-foreground` | порожній стан, назви полів у `dl`, посилання «назад» |
| Числа, дати, години | `tabular-nums` | колонки Date і Hours |

## 4. Відступи й радіуси

- Відступи — шкала Tailwind 4: `gap-1.5` між підписом і полем, `gap-4` між полями форми, `gap-6` між блоками сторінки, `gap-8` між великими розділами; `px-6 py-16` на `main`.
- Ширина контенту: форма входу `max-w-sm`, форма заявки й головна `max-w-2xl`, таблиці `max-w-3xl`. Усе по центру (`mx-auto`).
- Радіус: `--radius: 0.5rem`; похідні — `rounded-md`, `rounded-lg`. Картки й поля — `rounded-lg`.

## 5. Компоненти й варіанти

Лише з `@/components/ui`. Власні `<button>`, `<input>` зі стилями на сторінках не пишемо. Виняток: прапорці й радіокнопки (`type="checkbox"`, `type="radio"`) лишаються нативними з класом `size-4 accent-primary`; їхній підпис — завжди текстом поруч.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link` | `default` — одна основна дія на екран; `destructive` — лише з підтвердженням; посилання, що виглядає як кнопка, — `buttonVariants()` на `<Link>` |
| `Input` + `Label` | — | у кожного поля `Label` з `htmlFor`; placeholder — не замість підпису |
| `Textarea`, `NativeSelect` | — | з `Label`; нативний `select` лишаємо, щоб працювали клавіатура й системний список |
| `Card` | `default`, `sm` | форма входу й групи; не вкладаємо картку в картку |
| `Table` | — | списки записів (`My requests`, черга менеджера): заголовки колонок англійською, як у вимогах; числа з `tabular-nums` |
| `Badge` | `awaiting`, `approved`, `rejected`, `returned`, `cancelled` (статуси); `secondary`, `outline` | статус — завжди з текстом, не лише кольором |
| `Dialog` | — | підтвердження остаточних рішень (Approve/Reject: рішення не скасовується, PM, #17) |
| `Alert` | `destructive` (помилка), `warning` (попередження), `default` (інформація) | текст повідомлення — дослівно з AC; помилка не схожа на попередження |

## 6. Стани

Тексти — дослівно з AC PM (`requirements/`).

| Стан | Як виглядає | Приклад тексту |
|---|---|---|
| Порожній список | `text-muted-foreground`, без таблиці | «Заявок ще немає.»; у менеджера «No records awaiting decision» (AC-DECIDE-14) |
| Помилка дії («не збережено») | `Alert variant="destructive"` над кнопкою; введене лишається у формі | «The comment can be at most 500 characters» (AC-LEAVE-18) |
| Попередження («збережено, але...») | `Alert variant="warning"`, не червоний | «Your Personal leave balance is 0.50 day. Another 0.50 day will be counted as Unpaid leave» (AC-BALANCE-08) |
| Дату не прийнято | `Alert variant="warning"` у підсумку (запис для інших дат створено) | «You have no working hours on this day» (AC-LEAVE-21) |
| Помилка поля | `text-sm text-destructive` під полем, поле `aria-invalid` | «You have no working hours on this day» (AC-LEAVE-06) |
| Відмова в доступі | сторінка з поясненням, без даних | текст з AC конкретної вимоги |
| Завантаження | кнопка `disabled`, текст кнопки лишається | «Показати підсумок» |
| Успіх | оновлений список або підсумок; окремого зеленого банера не додаємо | — |
| Вимкнена дія | `disabled` + пояснення поруч | — |

## 7. Доступність — мінімум

- `Label` у кожного поля; помилка поля пов'язана з полем (`aria-invalid`, текст помилки поруч).
- Видимий фокус: кільце `ring` на кожному інтерактивному елементі; Tab проходить форму по порядку.
- Контраст — таблиця в розділі 2 (текст ≥ 4.5:1, межі полів і фокус ≥ 3:1).
- Статус і тип відпустки ніколи не лише кольором: поруч завжди текст (PM, #14).
- Спершу семантичний HTML (`<button>`, `<table>`, `<label>`); `aria-*` — там, де HTML бракує.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` | `bg-zinc-900 text-white`, `bg-[#0f6b6e]`, `style={{ color: "#…" }}` |
| компонент `Button` з потрібним варіантом | власний `<button className="…">` у сторінці |
| `Badge variant="approved"` з текстом «Approved» | зелена цятка без слова |
| `Alert variant="warning"` для «збережено, але…» | червоний текст для попередження |
| новий токен через розділ 9 | новий колір «лише для цієї сторінки» |
| `text-destructive` для тексту помилки | `text-red-600` |

## 9. Як додати токен

1. Опишіть токен у таблиці розділу 2: для чого, значення в обох темах, контраст.
2. `src/app/globals.css`: `--<назва>` у `:root` і в `@media (prefers-color-scheme: dark)`.
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`.
4. `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Візуально: знімки ключових сторінок у світлій і темній темі (`docs/img/ws7-before-*`, `docs/img/ws7-after-*`), Tab по формі, контраст.
