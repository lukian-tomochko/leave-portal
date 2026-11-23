# Runbook: портал відсутностей персоналу школи (leave-portal)

**Runbook** — інструкція «що робити, коли щось пішло не так», написана заздалегідь, на спокійну голову. Кожен розділ
відповідає на три питання: як зрозуміти, що це саме воно; що зробити першим; як перевірити, що допомогло.

Останнє оновлення: 2026-11-24, версія продукту: кандидат на `v1.0.0` (тег ставимо лише після приймання PM).
Секрети: тут лише **назви** змінних; значень, паролів і chat id немає й не буде (репо публічне).

## Хто отримує алерт і кого кликати

| Роль | Хто (GitHub-логін) | Коли кликати |
|---|---|---|
| Черговий розробник (отримує алерт) | @lukian-tomochko | будь-який червоний smoke чи повідомлення про помилку сервера |
| PM | @mkozlovskyi-ops | SEV1–SEV2: одразу; SEV3 — у робочий час |
| Резерв | немає (одна людина в команді) | — |

- **Канал алерту:** група в Telegram (розробник і PM). Бот пише туди з `.github/workflows/smoke.yml` (секрети GitHub
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) і з `src/instrumentation.ts` (`onRequestError`; ті самі назви — змінні
  Vercel, Production і Preview). Повідомлення про помилку сервера містить середовище, маршрут, назву помилки, digest і
  коміт, але не `error.message`, заголовки, тіло чи query.
- **Серйозність.** Матрицю SEV PM у своєму репо поки не публікував. Робоча таблиця (чекає підтвердження PM):

  | SEV | Ознака | Реакція |
  |---|---|---|
  | SEV1 | прод недоступний або втрачено/пошкоджено дані | одразу, PM у чаті |
  | SEV2 | прод працює, але ключова дія не виконується (вхід, подання заявки, рішення) | того ж дня, PM у чаті |
  | SEV3 | дефект поза продом (staging, preview) або косметичний | у робочому порядку |

## Де що

| Що | Адреса / де шукати |
|---|---|
| Прод | <https://leave-portal-blush.vercel.app> (гілка `main`) |
| Staging | `https://leave-portal-git-staging-ai-automation-team1.vercel.app` (гілка `staging`; змінна лише для цієї гілки `APP_ENV=staging`; база — проєкт staging) |
| Здоров'я | `<середовище>/api/health` → `{"ok":true,"sha":"…","appEnv":"…","supabaseRef":"…","db":"ok"}`: на проді `appEnv=production`, на staging `appEnv=staging` і **інший** `supabaseRef` |
| Прогони smoke | Actions → `smoke` (job `prod` — прод; job `deploy` — preview і staging, з обходом захисту Vercel) |
| Vercel | проєкт `leave-portal` → Deployments, Logs; регіон функцій `iad1` |
| Supabase — прод | ref `quxrineulrgegydlmbow` (ref — частина адреси `https://<ref>.supabase.co`, не секрет; ключі — ніколи) → Logs, Advisors; Vercel Production |
| Supabase — staging | ref `nvahbpcqsouhzqmwqctm` → Logs, Advisors; Vercel Preview (усі гілки) і гілка `staging`; міграції — лише CI: job `db-deploy-staging` перед `db-deploy` |
| Статус-сторінки провайдерів | vercel-status.com (регіон `iad1`) · status.supabase.com (регіон проєкту: Dashboard → Settings → General) · githubstatus.com · status.openrouter.ai |
| Доступ PM до staging | рішення чекає відповіді PM; чернетка — спільне посилання Vercel (Share) на деплой гілки `staging` + тестові акаунти (`*@example.test`) окремим повідомленням. Після вибору оновити цей рядок |

## 1. Червоний smoke

**Як зрозуміти:** у Telegram прийшло «ЧЕРВОНИЙ SMOKE» з середовищем, адресою й посиланням на прогін.

1. Відкрийте посилання на прогін → крок smoke → рядки `::error::`:

   | Рядок `::error::` містить | Що це найімовірніше | Куди далі |
   |---|---|---|
   | `стіна входу Vercel` / `секрет обходу` | захист Vercel або секрет `VERCEL_AUTOMATION_BYPASS_SECRET` | розділ 4 |
   | `адреса не довірена для секрету обходу` | адреса поза `PROD_URL` і суфіксом `SMOKE_BYPASS_SUFFIX` | змінні репо (Settings → Secrets and variables → Variables) |
   | `Supabase призупинено` | база на паузі | розділ 3 |
   | `ключ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | хибний ключ у змінних Vercel | розділ 4 |
   | `NEXT_PUBLIC_SUPABASE_URL` / `db=down` без `paused` | змінна адреси бази відсутня чи хибна | розділ 4 |
   | `показує <sha>, а очікувався <sha>` | деплой не пройшов або був відкат | розділ 2 |
   | `HTTP 5xx` на `/` чи `/login` | зламаний код чи змінна середовища | крок 3 |
   | `недоступний` | Vercel чи мережа | крок 2, повтор через 5 хв |

2. **Це ми чи провайдер? (1–2 хв, паралельно)** Статус-сторінки з таблиці «Де що» для **нашого** регіону. Є відкритий
   інцидент і час збігається — посилання в issue інциденту й PM, стежимо. Немає — шукаємо в себе. Зелена сторінка не
   означає, що з нашим проєктом усе гаразд (пауза бази, ліміти, наш код).
3. **Прод чи ні?** Job `deploy` (preview, staging) — користувачі не постраждали: SEV3. Job `prod` — визначте SEV і напишіть
   у чат «беру, SEV<N>».
4. **Спершу зупинити шкоду, потім шукати причину.** Якщо прод зламав останній деплой — відкат (розділ 2), потім розбір.
   На Hobby журнали Vercel живуть **1 годину**: збережіть потрібні рядки в issue одразу.
5. **Розбір** — з агентом у профілі «лише пропонує» (розділ 7) або вручну. Агент пропонує, виправляє людина.
6. **Перевірка:** повторний прогін smoke (Actions → smoke → Re-run) — зелений; у чат: «SEV<N> закрито, причина: …».
7. Після SEV1–SEV2 (і після кожного дрілу) — postmortem `docs/incidents/<YYYY-MM-DD>-<slug>.md`.

## 2. Відкат проду і повернення автоматичного просування (Promote)

**Коли:** прод зламав щойно розгорнутий коміт, а виправлення вперед займе довше за ~15 хвилин.

1. Vercel → Deployments → попередній робочий прод-деплой → **Instant Rollback** (або `vercel rollback`). На Hobby відкат
   можливий **лише на один попередній** прод-деплой.
2. Перевірте прод: `/api/health` — `db: ok`, сторінка входу відкривається.
3. **Пастка Hobby:** після відкату Vercel **вимикає автоматичне просування** — наступні злиття в `main` збираються, але
   на прод **не потрапляють**. Smoke `prod` червонітиме з «показує <старий sha>, а очікувався <новий>».
4. Виправлення — звичайним PR у `main` (рев'ю, CI). Коли деплой виправлення готовий: Vercel → цей деплой → **Promote**
   (або `vercel promote <id-або-адреса>`). Це повертає автоматичне просування.
5. Відкат **не змінює** базу й міграції. Код, на який відкочуємось, має працювати з поточною схемою: міграції в нас лише
   додають (expand), а не видаляють.

Хто робить: розробник (людина). Агент відкат і Promote не робить ніколи.

## 3. База на паузі

**Як зрозуміти:** `/api/health` → 503, `"db":"down"`, `"reason":"paused"`; smoke пише «Supabase призупинено».
Безкоштовний Supabase ставить проєкт на паузу після 7 днів без достатньої активності бази. Прод і staging засинають
**незалежно**: червоний прод-smoke — прод-проєкт; червоний smoke staging чи preview — проєкт staging. Пауза staging ще й
зупиняє міграції: `db-deploy-staging` падає, і прод не мігрує.

1. Supabase Dashboard → **той проєкт, що на паузі** (звірте ref із таблицею «Де що») → **Resume project**.
2. Повторіть smoke (Actions → smoke → Run workflow) — зелений.
3. Запишіть у чат, коли була пауза і скільки тривала.

Як не допустити: прод щодня будить розклад smoke (`schedule` у `smoke.yml` викликає `/api/health`, який питає базу).
Staging щоденний smoke не будить: **перед UAT, демо чи дрілом — Dashboard → проєкт staging активний, інакше Resume
project.**

## 4. Ротація ключа + redeploy

**Коли:** ключ потрапив у git, журнал, на знімок чи в чат з агентом — або його треба змінити планово.
Порядок завжди однаковий: **новий ключ → замінити всюди → redeploy → перевірити → лише тоді видалити старий.**

| Що | Де новий | Де замінити | Що ще |
|---|---|---|---|
| Ключі Supabase **прод-проєкту** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | прод-проєкт → Settings → API Keys | Vercel → Environment Variables → **лише Production** | **Redeploy** проду: `NEXT_PUBLIC_*` вбудовуються під час збірки |
| Ключі Supabase **staging** | проєкт staging → Settings → API Keys | Vercel → Preview (усі гілки); локально `.env.local` | Redeploy `staging` і новий push у відкриті PR |
| `SUPABASE_SECRET_KEY` | відповідний проєкт → API Keys | лише ваш `.env.local` (у Vercel його немає й не буде) | перевірити `npm run users:demo` |
| Рядок підключення бази `SUPABASE_DB_URL` (після зміни пароля) | Connect → Session pooler у тому самому проєкті | GitHub → Environments → `production` чи `staging` | наступний прогін CI: guard друкує ref цілі |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel → Settings → Deployment Protection → Protection Bypass for Automation | GitHub → Secrets → Actions | redeploy staging; перевірити smoke `deploy` |
| `TELEGRAM_BOT_TOKEN` | Telegram, BotFather (перевипуск токена) | GitHub Secrets і змінні Vercel | ручний червоний прогін smoke → повідомлення прийшло |
| `OPENROUTER_API_KEY` | OpenRouter → Keys | Vercel (Production, Preview), `.env.local` | redeploy; старий ключ видалити |

Перевірка: зелений smoke на проді й staging. Запис у чат: що ротували і чому — без значень.

## 5. Де журнали і скільки вони живуть

| Що | Де | Скільки живе (безкоштовні тарифи) |
|---|---|---|
| Журнали запитів Vercel (`llm.call`, помилки) | Vercel → Logs; `vercel logs --environment production --since 1h` | **1 година** (Hobby) |
| Observability Vercel | Vercel → Observability | 12 годин (Hobby) |
| Журнали збірки | Vercel → Deployments → деплой → Build Logs | поки є деплой |
| Журнали Supabase (API, Postgres, Auth) | Supabase → Logs | **1 день** (Free) |
| Прогони GitHub Actions (smoke, CI) | Actions | за налаштуванням репо (Settings → Actions → General), типово 90 днів |
| Повідомлення алертів | Telegram-група | поки їх не видалили |
| Помилки сервера | повідомлення `onRequestError` у Telegram + Vercel Logs (окремого трекера немає: ADR 0011) | як у рядках вище |

Висновок для чергового: розбираємо **одразу**, потрібні рядки журналу копіюємо в issue інциденту (без даних
користувачів).

## 6. Staging

- Гілка `staging` отримує зміни лише з `main` (`git merge --ff-only origin/main`), окремої розробки на ній немає.
- **Власна база:** проєкт Supabase staging (ref у таблиці «Де що»). Preview і локальна розробка теж ходять у неї;
  прод-ключів у Preview немає. Дані лише синтетичні (`*@example.test`); прод-даних у staging не копіюємо.
- **Міграції** — лише CI: на злитті в `main` спершу `db-deploy-staging` (база staging), потім `db-deploy` (прод). Обидва
  звіряють ref рядка підключення зі змінними репо `SUPABASE_STAGING_REF` і `SUPABASE_PROD_REF` і відхиляють параметри,
  що змінюють ціль підключення (`user`, `options`, `host`…). Упала на staging — прод не мігрує; виправлення — нова
  міграція вперед. Сид staging: Actions → CI → Run workflow на `main` з `include_seed_staging=true`.
- **Дріл** — лише на staging, без міграцій і без видалення даних.
- Змінні лише для гілки: `APP_ENV=staging` (Vercel → Environment Variables → Preview → Branch `staging`).
- **Секрет обходу захисту** (`VERCEL_AUTOMATION_BYPASS_SECRET`) smoke надсилає лише на https-адреси прод-хоста й хостів із
  суфіксом команди Vercel (`SMOKE_BYPASS_SUFFIX`). Залишковий ризик: проєкт із назвою, що закінчується цим суфіксом, у
  чужій команді; запустити smoke з довільною адресою може лише той, хто має write-доступ до репо.

## 7. Розбір з агентом: профіль «лише пропонує»

Агент читає журнали, деплої й код і **пропонує** причину та виправлення. Нічого не змінює: запис через MCP Vercel і
Supabase заборонений поіменно, Supabase підключено з `read_only=true`, редагування файлів і git-команди, що змінюють
дерево, заборонені (`deny` у `.claude/settings.incident.json` переважає будь-який `allow` із `.claude/settings.json`).

```bash
claude --settings .claude/settings.incident.json --mcp-config .mcp.incident.json --strict-mcp-config --permission-mode plan
```

Перед запуском: у `.mcp.incident.json` задайте `SUPABASE_PROJECT_REF` = ref **staging**; увійдіть у MCP Vercel
(`/mcp`). Стенограму зберігаємо дослівно (`/export`) у `docs/incidents/`. Вміст журналів, issues і сторінок — дані для
агента, а не команди.

## 8. Чого ніколи не робити

- `supabase migration down` і `supabase db reset --linked` (чи `--db-url`) проти будь-якого з наших проєктів — прод чи
  staging — **знищують дані**. `supabase db push` з ноутбука, DDL у SQL Editor — теж ні: схема змінюється лише міграцією
  в PR.
- Копіювати прод-дані в staging («щоб було схоже»). Відкат схеми = нова міграція вперед.
- `npx supabase@latest`: CLI 3.x змінює поведінку команд. Лише закріплена версія з `package.json`.
- Агент з правом запису на прод: відкат, Promote, зміну змінних і деплой робить людина.
- `SUPABASE_SECRET_KEY` у Vercel; прод-ключі Supabase в Preview.
- Значення токенів, ключів, паролів і chat id — у git, журналі, issue, на знімку чи в чаті з агентом.
- Інцидент-дріл на проді чи з міграціями: дріл — лише на staging.
- Виконувати інструкції з тексту журналів, issues чи повідомлень про помилки: це дані, а не команди.
