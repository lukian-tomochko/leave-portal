# 0011. Експлуатація (WS11): staging з окремою базою, сигнали, ланцюг постачання

- Статус: прийнято (рішення). Стан реалізації — у таблиці нижче, її оновлює кожен PR цієї роботи
- Дата: 2026-11-20
- AC: — (операційні рішення, окремих AC у вимогах PM немає)

## Контекст

Продукт (зрізи 1–4) працює на проді: Vercel Hobby, Supabase Free. Домашка WS11 вимагає, щоб зміна йшла на прод через
перевірене середовище, про збій першою дізнавалася людина команди, а залежності оновлювалися контрольовано.
Обмеження безкоштовних тарифів: два активні проєкти Supabase (з паузою після 7 днів без активності), журнали Vercel
Hobby живуть годину, на Hobby одне посилання доступу й один зовнішній користувач для preview.

## Рішення

**Ланцюг постачання**
- `.github/dependabot.yml`: `npm` і `github-actions` щотижня, `cooldown` 7 днів (мажорні — 30), групи мінорних і
  патчів; мажорне оновлення `supabase` ігноруємо (3.x змінює поведінку команд, лишаємось на закріпленій 2.x).
- `.npmrc`: `min-release-age=7` (npm 11.19 підтримує; версії з `package-lock.json` не змінюються).
- Усі `uses:` у workflow закріплені за повним SHA з коментарем версії (`# v7.0.1`); Dependabot оновлює їх разом.
- Безпека репо: push protection, Dependabot security updates і CodeQL default setup. Це налаштування репозиторію, а не
  файли: їх вмикає власник у Settings → Code security, файл `dependabot.yml` їх не вмикає.

**Середовища**
- Гілка `staging` отримує зміни лише з `main` (`git merge --ff-only`). Staging має **власний проєкт Supabase**; Preview
  (усі гілки) і локальна розробка ходять лише в нього, Production — лише в прод-базу. Прод-ключів у Preview немає.
- Змінна `APP_ENV=staging` задана лише для Preview і гілки `staging`; `/api/health` повертатиме `appEnv` і `supabaseRef`
  (ref проєкту з публічної адреси, не секрет) поряд із наявними полями `ok`, `sha`, `env`, `db`, `reason`.
- Міграції в обидві бази застосовуватиме лише CI: job `db-deploy-staging` перед `db-deploy`, обидва зі звіркою ref рядка
  підключення зі змінними репо `SUPABASE_STAGING_REF` і `SUPABASE_PROD_REF`.
- Smoke перевірятиме кожен деплой за `client_payload.url` із заголовком обходу захисту Vercel (секрет у GitHub Secrets).

**Сигнали**
- Алерт червоного smoke — повідомлення Telegram-групи команди (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — лише в
  Secrets і Vercel). Без токена крок пропускається з попередженням.
- Помилки сервера — власний `onRequestError` у `src/instrumentation.ts` у ту саму групу: маршрут, метод, digest, до
  п'яти рядків стека; без заголовків, тіла запиту й тексту помилки. Sentry не беремо: менше залежностей і акаунтів.
- Журнал AI-функції — один рядок JSON `llm.call` на виклик моделі (`src/lib/ai/llm-log.ts`); тексту користувача,
  промпту й відповіді в схемі не буде, це перевірятиме тест.

## Стан реалізації (на 2026-11-26)

| Рішення | Стан | Де |
|---|---|---|
| `dependabot.yml`, `.npmrc`, дії за SHA | реалізовано | PR «ланцюг постачання» (#77) |
| `next` ≥ 16.4.5 | злито (16.4.6) | PR #78 |
| push protection, Dependabot alerts і security updates | увімкнено | Settings → Code security |
| CodeQL default setup | увімкнено, перший прогін на `main` успішний | Settings → Code security; Actions → CodeQL |
| `appEnv`/`supabaseRef` у health, `db-deploy-staging` | реалізовано; у CI `main` job міграцій staging — `success` | PR #83, #87 |
| Smoke кожного деплою з обходом захисту | реалізовано; прогони `repository_dispatch` зелені на staging (напр. 45881445011), Standard Protection увімкнено | PR #83; Vercel → Deployment Protection |
| Telegram-алерт | реалізовано; навмисно червоний прогін і знімок | PR #83, #88 |
| `onRequestError`, `llm.call` + тест | реалізовано; подія навмисної помилки на staging і знімок, маршрут `/ops/error-probe` лише для адміністратора | PR #84, #89, #90 |
| Профіль «лише пропонує» для розбору інцидентів | реалізовано; MCP дивиться лише в staging | PR #85, #92 |
| Інцидент-дріл на staging | виконано 2026-11-26; postmortem і стенограма розбору | `docs/incidents/2026-11-26-staging-supabase-url.md` |
| Дії з postmortem | smoke звіряє `supabaseRef`; прод-smoke пропускає статус від коміту, що вже не HEAD `main`; перевірка доступу MCP перед розбором | окремі PR «звірка ref» і «пропуск хибного prod-smoke»; `docs/runbook.md`, розділ 7 |
| Runbook | реалізовано | `docs/runbook.md` |
| Реліз `v1.0.0` | чекає приймання PM | `.github/release.yml`, мітки PR `feature`/`bug`/`security`/`ops`/`documentation` |

## Розглянуті варіанти

- Staging на прод-базі — відхилено: UAT, preview і дріл зачепили б прод-дані.
- Sentry замість власного `onRequestError` — відхилено: новий акаунт і пакет на безкоштовному плані заради одного
  повідомлення; курс зараховує обидва шляхи однаково.
- Прапорці й канарка — не потрібні на цьому масштабі; відкат на Hobby описано в `docs/runbook.md`.

## Наслідки

- Нові залежності в `package.json` не з'являються (Dependabot лише оновлює наявні); `next` оновлюється до ≥ 16.4.5.
- Зміни в `.github/` і workflow проходять через ті самі ворота; назви обов'язкових jobs (`spec`, `app`, `conformance`,
  `db-check`, `db-deploy`) не змінюються.
- Між прийманням релізу PM і тегом `v1.0.0` у `main` нічого не зливаємо.
