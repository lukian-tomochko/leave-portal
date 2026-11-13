# Дизайн-система: портал відсутностей персоналу школи («Bento»)

- **Джерело:** AI-агент (Claude Code) за рішенням [ADR 0008](docs/decisions/0008-bento-redesign.md); значення контрасту пораховані скриптом (OKLCH → sRGB → WCAG 2.x) із `src/app/globals.css`, а не прикинуті на око. Інтерактивний прототип редизайну погоджено власником продукту до реалізації.
- **Вхід від PM:** розділу «Вигляд і тон» у `requirements/product.md` немає: PM відповів, що вигляд — на розсуд розробника ([питання #18](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/18)). Тому спираємось на бачення продукту й ролі (`requirements/product.md`) та на три правила PM про зміст, а не стиль:
  - тип відпустки й статус запису **завжди текстом**; колір лише додається, ніколи не замінює текст ([#14](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/14));
  - попередження («запис створено, але зверніть увагу») не має виглядати як помилка («не збережено») ([#16](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/16));
  - «My requests» — список; календар — необов'язкова добавка ([#15](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/15)).
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui) і `src/components/bento/`, `dashboard/`, `calendar/`; перевірка — `npm run check:design`

## 1. Огляд

Інтерфейс для вчителів, асистентів, менеджерів і адміністратора школи: вони відкривають портал на комп'ютері, щоб подати заявку, перевірити баланс чи ухвалити рішення. Мобільна верстка поза межами продукту (`requirements/product.md`, «Out of scope»). Тон: сучасний, живий, але точний.

- **Каркас:** лівий сайдбар (назва, навігація з пілюлею, що ковзає, бейдж черги рішень, перемикачі теми й руху, хто увійшов, «Вийти»). Сайдбар не згортається. На сторінці входу сайдбара немає.
- **Мова форми «Bento»:** контент складається з плиток (`Tile`, `Card`) з великим радіусом і м'якою тінню на холодному лавандово-сірому тлі. Одна плитка — одне число, діаграма чи список. Головна й календар — сітка з 12 колонок, решта сторінок — одна колонка плиток.
- **Акцент:** корал (`primary`) для єдиної основної дії на екрані й активних станів; фіолетовий (`link`, `ring`) для посилань і фокусу.
- **Тема:** світла й темна з перемикачем у сайдбарі (вибір зберігається), за замовчуванням — системна (скрипт у `layout.tsx` ставить `data-theme` до першого малювання; без JS — світла).
- **Дані на головній:** працівник бачить баланси кільцями, статуси заявок, найближчу відсутність, місяць, використані дні й закриття. Менеджер і адміністратор — чергу рішень, хто відсутній, покриття, теплову карту на три тижні й розподіл за типами.

## 2. Кольори

Значення — OKLCH. У сторінках лише утиліти з колонки «Клас»: ніколи hex, `bg-[#…]`, сирі палітри (`zinc-500`, `bg-white`) чи колір у `style`. Тло й нейтралі злегка підфарбовані тим самим фіолетово-синім відтінком (≈ 276°), корал — 36–39°.

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й основний текст | `oklch(0.949 0.008 271)` / `oklch(0.21 0.041 278)` | `oklch(0.169 0.027 276)` / `oklch(0.958 0.02 280)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | плитки, панелі, сайдбар | `oklch(1 0 0)` / `oklch(0.21 0.041 278)` | `oklch(0.223 0.045 277)` / `oklch(0.958 0.02 280)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | меню, діалоги, підказки діаграм | як `card` | як `card` | `bg-popover` |
| `primary` / `primary-foreground` | основна дія (одна на екран), акценти, пілюля навігації | `oklch(0.683 0.209 36)` / `oklch(0.21 0.041 278)` | `oklch(0.727 0.173 39)` / `oklch(0.17 0.03 40)` | `bg-primary`, `text-primary-foreground` |
| `primary-soft` | активний пункт навігації, підсвічування плитки | `oklch(0.936 0.034 41)` | `oklch(0.28 0.043 38)` | `bg-primary-soft` |
| `link` | посилання й текстові акценти (не `primary`: корал на білому слабший за 4.5:1) | `oklch(0.55 0.253 278)` | `oklch(0.72 0.17 285)` | `text-link` |
| `secondary` / `secondary-foreground` | другорядна дія | `oklch(0.94 0.014 276)` / `oklch(0.21 0.041 278)` | `oklch(0.3 0.06 277)` / `oklch(0.958 0.02 280)` | `bg-secondary` |
| `muted` / `muted-foreground` | приглушене тло, підписи, допоміжний текст | `oklch(0.971 0.007 277)` / `oklch(0.454 0.051 277)` | `oklch(0.267 0.063 276)` / `oklch(0.764 0.049 277)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | наведення, вибраний елемент, аватар | `oklch(0.924 0.039 290)` / `oklch(0.21 0.041 278)` | `oklch(0.294 0.1 281)` / `oklch(0.958 0.02 280)` | `bg-accent` |
| `destructive` / `destructive-foreground` | помилка («не збережено»), небезпечна дія | `oklch(0.496 0.177 18)` / `oklch(0.985 0 0)` | `oklch(0.769 0.139 13)` / `oklch(0.16 0.03 13)` | `text-destructive`, `bg-destructive` |
| `warning` / `warning-foreground` | попередження («збережено, але зверніть увагу») | `oklch(0.95 0.047 81)` / `oklch(0.499 0.114 63)` | `oklch(0.3 0.049 82)` / `oklch(0.864 0.128 79)` | `bg-warning`, `text-warning-foreground` |
| `overlay` | затемнення за діалогом | `oklch(0.17 0.03 278 / 55%)` | `oklch(0 0 0 / 60%)` | `bg-overlay` |
| `border` | розділювачі, межі плиток і таблиць | `oklch(0.917 0.015 274)` | `oklch(0.323 0.073 276)` | `border-border` |
| `input` | межа поля вводу | `oklch(0.603 0.044 277)` | `oklch(0.607 0.059 275)` | `border-input` |
| `ring` | кільце фокусу | `oklch(0.55 0.253 278)` | `oklch(0.72 0.17 285)` | `ring-ring` |
| `status-awaiting` | запис «Awaiting decision» (тло / текст) | `oklch(0.95 0.047 81)` / `oklch(0.499 0.114 63)` | `oklch(0.3 0.049 82)` / `oklch(0.864 0.128 79)` | `bg-status-awaiting`, `text-status-awaiting-foreground` |
| `status-approved` | запис «Approved» | `oklch(0.939 0.031 168)` / `oklch(0.515 0.106 163)` | `oklch(0.309 0.05 170)` / `oklch(0.828 0.133 166)` | `bg-status-approved`, `text-status-approved-foreground` |
| `status-rejected` | запис «Rejected» | `oklch(0.932 0.033 6)` / `oklch(0.496 0.177 18)` | `oklch(0.266 0.064 5)` / `oklch(0.769 0.139 13)` | `bg-status-rejected`, `text-status-rejected-foreground` |
| `status-returned` | запис «Returned for revision» | `oklch(0.921 0.039 303)` / `oklch(0.483 0.178 296)` | `oklch(0.287 0.085 293)` / `oklch(0.783 0.129 299)` | `bg-status-returned`, `text-status-returned-foreground` |
| `status-cancelled` | запис «Cancelled» | `oklch(0.932 0.011 275)` / `oklch(0.472 0.036 275)` | `oklch(0.299 0.049 277)` / `oklch(0.77 0.035 274)` | `bg-status-cancelled`, `text-status-cancelled-foreground` |
| `fill-awaiting` … `fill-cancelled` | насичені заливки статусів у діаграмах, календарі, теплових картах | `oklch(0.807 0.148 77)`, `0.718 0.141 164`, `0.665 0.179 13`, `0.643 0.17 297`, `0.734 0.031 275` | ті самі | `bg-fill-awaiting`, `bg-fill-approved`, `bg-fill-rejected`, `bg-fill-returned`, `bg-fill-cancelled` |
| `leave-sick` / `leave-personal` / `leave-unpaid` / `leave-family` | типи відпусток у діаграмах і кільцях | `oklch(0.665 0.179 13)`, `0.55 0.253 278`, `0.734 0.031 275`, `0.718 0.141 164` | `leave-personal` світліший (`0.72 0.17 285`), решта ті самі | `bg-leave-*`, `stroke-leave-*` |
| `blob-a` / `blob-b` / `blob-c` | великі фонові плями (декор) | `oklch(0.829 0.098 38)`, `0.785 0.116 288`, `0.857 0.072 172` | `oklch(0.409 0.11 36)`, `0.373 0.173 276`, `0.42 0.075 169` | `bg-blob-a` … |
| `shadow-tile` | тінь плитки | `0 1px 2px … 5%, 0 8px 24px … 6%` | `0 1px 2px … 30%, 0 10px 28px … 35%` | `shadow-tile` |

Статусні токени подано як «тло / текст». Статус у інтерфейсі — це `Badge` з текстом статусу (`StatusBadge`, `STATUS_LABELS` у `src/lib/leave/messages.ts`); колір лише підсилює слово. Заливки `fill-*` ніколи не стоять без текстової легенди чи `title`.

### Контраст

Порахований скриптом за формулою WCAG 2.x з OKLCH → sRGB, значення беруться із `globals.css`. Усі пари проходять норму в обох темах. Текст на заливках `fill-*` — `primary-foreground` (темний в обох темах).

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 15.34 | 16.94 | ≥ 4.5 |
| `card-foreground` на `card` | 17.81 | 15.27 | ≥ 4.5 |
| `muted-foreground` на `background` | 6.36 | 9.01 | ≥ 4.5 |
| `muted-foreground` на `card` | 7.38 | 8.12 | ≥ 4.5 |
| `muted-foreground` на `muted` | 6.78 | 7.22 | ≥ 4.5 |
| `primary-foreground` на `primary` | 5.72 | 7.44 | ≥ 4.5 |
| `foreground` на `primary-soft` | 14.62 | 13.07 | ≥ 4.5 |
| `secondary-foreground` на `secondary` | 14.92 | 12.18 | ≥ 4.5 |
| `accent-foreground` на `accent` | 14.13 | 12.64 | ≥ 4.5 |
| `destructive` на `card` | 6.72 | 7.82 | ≥ 4.5 |
| `destructive` на `background` | 5.78 | 8.67 | ≥ 4.5 |
| `destructive-foreground` на `destructive` | 6.43 | 8.82 | ≥ 4.5 |
| `link` на `card` | 5.38 | 6.54 | ≥ 4.5 |
| `link` на `background` | 4.64 | 7.26 | ≥ 4.5 |
| `warning-foreground` на `warning` | 5.37 | 8.95 | ≥ 4.5 |
| `status-awaiting-foreground` на `status-awaiting` | 5.37 | 8.95 | ≥ 4.5 |
| `status-approved-foreground` на `status-approved` | 4.51 | 8.02 | ≥ 4.5 |
| `status-rejected-foreground` на `status-rejected` | 5.43 | 7.07 | ≥ 4.5 |
| `status-returned-foreground` на `status-returned` | 5.50 | 7.10 | ≥ 4.5 |
| `status-cancelled-foreground` на `status-cancelled` | 5.56 | 6.63 | ≥ 4.5 |
| `primary-foreground` на `fill-awaiting` | 9.59 | 10.34 | ≥ 4.5 |
| `primary-foreground` на `fill-approved` | 7.59 | 8.19 | ≥ 4.5 |
| `primary-foreground` на `fill-rejected` | 5.34 | 5.77 | ≥ 4.5 |
| `primary-foreground` на `fill-returned` | 5.02 | 5.41 | ≥ 4.5 |
| `primary-foreground` на `fill-cancelled` | 7.53 | 8.12 | ≥ 4.5 |
| `input` на `card` (межа поля) | 3.93 | 4.47 | ≥ 3 |
| `ring` на `background` (фокус) | 4.64 | 7.26 | ≥ 3 |
| `primary` на `card` (межа кнопки, пульс «сьогодні») | 3.11 | 6.69 | ≥ 3 |

## 3. Типографіка

Текст — Geist (`next/font`, `--font-geist-sans`, клас `font-sans`), заголовки й великі числа — Onest (`--font-onest`, клас `font-display`). Обидва шрифти підключені з підмножиною `cyrillic`, бо інтерфейс українською. Тексти повідомлень із вимог PM лишаються дослівно такими, як у AC (англійською). Дати, години й числа — `tabular-nums`.

| Роль | Клас | Де |
|---|---|---|
| Заголовок сторінки | `font-display text-3xl font-bold tracking-tight` | один `h1` на сторінку (`PageHeader`) |
| Велике число плитки | `font-display text-6xl font-bold tracking-tight` | лічильники на головній |
| Заголовок плитки | `text-sm font-semibold` | `TileHeader` (рівня `h2`) |
| Заголовок розділу | `font-display text-lg font-bold` | `h2` усередині сторінки |
| Основний текст | `text-sm` | форми, таблиці, списки |
| Підпис, допоміжний текст | `text-xs`/`text-sm text-muted-foreground` | порожній стан, легенди, `dl` |
| Заголовки колонок | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` | `TableHead` (текст у розмітці незмінний, велику літеру дає CSS) |

## 4. Відступи, радіуси, тіні

- Відступи — шкала Tailwind 4: `gap-4` між плитками, `p-5` усередині плитки, `gap-1.5` між підписом і полем, `gap-4` між полями форми. Зовнішній відступ дає каркас (`p-4`), тому на сторінках `main` без `px`/`max-w` (вузькі форми — `max-w-3xl` без `mx-auto`).
- Радіус: `--radius: 0.875rem`; плитки `rounded-3xl`, картки `rounded-2xl`, поля й алерти `rounded-xl`, кнопки й бейджі `rounded-full`.
- Тінь плитки — токен `shadow-tile`; межа — `border-border`. Нових тіней із довільним кольором не додаємо.
- Сітка головної й календаря — `grid grid-cols-12 gap-4`; плитка займає 3–12 колонок (`col-span-*`).

## 5. Компоненти й варіанти

Лише з `@/components/ui` та спільних шматків `@/components/bento` (`Tile`, `TileHeader`, `PageHeader`, `CountUp`, `Ring`, `Gauge`), `@/components/dashboard`, `@/components/calendar` і `StatusBadge`. Власні `<button>`, `<input>` зі стилями на сторінках не пишемо. Виняток: прапорці й радіокнопки (`type="checkbox"`, `type="radio"`) лишаються нативними з класом `size-4 accent-primary`; їхній підпис — завжди текстом поруч.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link` | `default` — одна основна дія на екран; `destructive` — лише з підтвердженням; посилання, що виглядає як кнопка, — `buttonVariants()` на `<Link>` |
| `Input` + `Label` | — | у кожного поля `Label` з `htmlFor`; placeholder — не замість підпису |
| `Textarea`, `NativeSelect` | — | з `Label`; нативний `select` лишаємо, щоб працювали клавіатура й системний список |
| `Card` | `default`, `sm` | форма входу й групи; не вкладаємо картку в картку |
| `Tile` / `TileHeader` | `hero` | плитка bento з вхідною анімацією, підсвічуванням і нахилом; `hero` — інверсна акцентна плитка; одна на сторінку |
| `Table` | — | списки записів (`My requests`, черга менеджера): заголовки колонок англійською, як у вимогах; числа з `tabular-nums` |
| `Badge` / `StatusBadge` | `awaiting`, `approved`, `rejected`, `returned`, `cancelled` (статуси); `secondary`, `outline` | статус — завжди з текстом, не лише кольором |
| `Ring`, `Gauge` | — | кільце й датчик балансу/покриття; значення дублює текст поруч, SVG — `role="img"` із підписом |
| `MonthGrid`, `YearTimeline` | — | місячна сітка (клік по дню відкриває деталі) і річна стрічка; легенда `CalendarLegend` завжди поруч |
| `MonthlyChart` | — | стовпчики за місяцями (`recharts`); підсвічено поточний місяць; підсумок у `aria-label` |
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
| Завантаження | сторінка — `loading.tsx` зі скелетоном (`PageSkeleton`: розміри справжньої сторінки, без заголовків і текстів, `aria-busy` на `main`); дія — кнопка `disabled` із `Spinner` перед підписом, текст кнопки лишається | «Показати підсумок» |
| Успіх | оновлений список або підсумок; окремого зеленого банера не додаємо | — |
| Вимкнена дія | `disabled` + пояснення поруч | — |

## 7. Доступність — мінімум

- `Label` у кожного поля; помилка поля пов'язана з полем (`aria-invalid`, текст помилки поруч).
- Видимий фокус: кільце `ring` на кожному інтерактивному елементі; Tab проходить форму по порядку.
- Контраст — таблиця в розділі 2 (текст ≥ 4.5:1, межі полів і фокус ≥ 3:1).
- Статус і тип відпустки ніколи не лише кольором: поруч завжди текст (PM, #14). Діаграми мають підсумок у `aria-label`, календар — панель дня й легенду.
- Спершу семантичний HTML (`<button>`, `<table>`, `<label>`); `aria-*` — там, де HTML бракує.
- Рух не несе змісту: усе, що анімується, є й без анімації. `prefers-reduced-motion` і перемикач «Рух: спокійний» вимикають анімації.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` | `bg-zinc-900 text-white`, `bg-[#ff5a2c]`, `style={{ color: "#…" }}` |
| компонент `Button` з потрібним варіантом | власний `<button className="…">` у сторінці |
| `StatusBadge` з текстом «Approved» | зелена цятка без слова |
| `Alert variant="warning"` для «збережено, але…» | червоний текст для попередження |
| `text-link` для текстових посилань | `text-primary` для дрібного тексту (корал на білому < 4.5:1) |
| новий токен через розділ 9 | новий колір «лише для цієї сторінки» |
| `text-destructive` для тексту помилки | `text-red-600` |
| анімувати `opacity`, `transform`, `filter`, `stroke-dasharray` | анімувати ширину/висоту, що зсувають макет, і тексти повідомлень |

## 9. Як додати токен

1. Опишіть токен у таблиці розділу 2: для чого, значення в обох темах, контраст (скрипт-розрахунок із `globals.css`).
2. `src/app/globals.css`: `--<назва>` у `:root` (світла тема) і в `:root[data-theme="dark"]` (темна).
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`, `stroke-<назва>`.
4. `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Рух

Рух у цьому порталі дає відчуття живого інтерфейсу, але ніколи не несе змісту і не блокує дію. Усе вимикається `prefers-reduced-motion` та перемикачем «Рух: спокійний» (`data-motion="calm"` на `<html>`, зберігається в `localStorage`).

| Токен (`globals.css`, `:root`) | Значення | Для чого |
|---|---|---|
| `--motion-fast` | 120 мс | hover, active, фокус, перемикання кольору |
| `--motion-base` | 180 мс | швидкі появи, згортання блоків форми |
| `--motion-slow` | 400 мс | діалоги, невеликі підйоми (`animate-rise`) |
| `--motion-enter` | 700 мс | вхід плиток (`animate-bloom`) |
| `--motion-exit` | 400 мс | відліт старої сторінки при переході |
| `--motion-chart` | 1200 мс | заповнення кілець, смуг і лічильників |
| `--motion-ease` (клас `ease-soft`) | `cubic-bezier(0.22, 1, 0.36, 1)` | усі переходи: швидкий старт, м'яка зупинка |

- **Вхід плиток:** `animate-bloom` (прозорість, підйом на 34 px, розмиття 10 px → 0), затримка за номером плитки (до 10 кроків по 90 мс, компонент `Tile`). Рядки списків — `animate-rise` із затримкою.
- **Графіки:** кільця й смуги заповнюються CSS-анімацією (`animate-ring-fill`, `animate-stack-grow`) із затримкою 0.55 с; числа набігають від нуля за 1.8 с (`CountUp`: сервер віддає кінцеве значення, тож без JS і в тестах число правильне); `recharts` анімує стовпчики тільки коли рух дозволено.
- **Постійний рух (ambient):** дрейф трьох кольорових плям (`animate-drift`), плаваючі орби в hero-плитках (`animate-float`), пульс «сьогодні» в календарі (`animate-ping-soft`), «дихання» бейджа черги рішень (`animate-beat`), легке погойдування логотипа. Усе повільне й декоративне, `aria-hidden`.
- **Взаємодія:** підсвічування й легкий нахил плитки за курсором (`Tile`), пілюля навігації ковзає між пунктами (spring, `motion`), кнопки злегка підіймаються на hover.
- **Перехід між сторінками:** `<ViewTransition enter="page-in" exit="page-out" default="none">` у каркасі. Стара сторінка відпливає вліво з розмиттям (`page-out`, 800 мс), нова з'являється блоками (`bloom`). Лише на зміні маршруту: оновлення параметрів тієї самої сторінки (рік, місяць, фільтр) не анімується, щоб не було відчуття перезавантаження. Статус запису плавно переїжджає зі списку на сторінку запису (`status-${id}`, клас `status-morph`).
- **Не анімуємо:** помилки валідації й тексти AC (їх треба прочитати одразу), ширину й висоту, що зсувають макет.
- **Менше руху:** під `prefers-reduced-motion: reduce` усі анімації й переходи вимикаються (`globals.css`); UAT записується з `reducedMotion: "reduce"` (`playwright.config.ts`), тож кадри «Тоді» показують кінцевий стан.
- Нова тривалість чи крива — лише новим токеном у цій таблиці й у `globals.css`.

## 11. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Візуально: знімки ключових сторінок у світлій і темній темі (`docs/img/`), Tab по формі, контраст, перегляд із `prefers-reduced-motion`.
