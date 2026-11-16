# Tasks

Вертикальні задачі: кожна — доменна функція + Server Action/сторінка + тести. Кожна задача — окремий PR «Реалізація»
(`task/<коротко>`), у тому самому PR оновлюємо рядки `docs/conformance.md` для її AC. Перевірка: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, `npm run ac:coverage`, `npm run spec:check`, `npm run check:design`,
`npm run check:boundary`, `npm run check:english`, `npm run gates`. Перед кодом сторінок читаємо `node_modules/next/dist/docs/`.
Скрізь: лише синтетичні дані (`*@example.test`), `getClaims()` замість `getSession()`, роль із `profiles`, тести —
`it("AC-…: …")` у `*.test.ts(x)` з `expect(…)`; тести пише окрема сесія агента лише з тексту AC. CI ніколи не кличе модель;
живий eval і прод-UAT запускає людина. Ключ `OPENROUTER_API_KEY` — лише `.env.local` і Vercel, ніколи в git чи чаті.

## 1. Основа AI-функції: ADR, залежності, схема, правила, промпт, модель (AC-ASSIST-05, 06, 07, 09, 10 — доменний рівень)

- [ ] 1.1 ADR `docs/decisions/0010-ai-feature-openrouter.md` (залежності `ai`, `@openrouter/ai-sdk-provider`, `zod`,
  `server-only` з точними версіями; безкоштовні `:free` моделі; ключ лише на сервері); правка правила про секрети в
  `AGENTS.md` і рядок `OPENROUTER_API_KEY=` у `.env.example`; `npm i --save-exact …`; скрипти `eval`, `ai:models`, `ai:quota`.
- [ ] 1.2 `tests/fixtures/golden/cases.json`: GC-01…10 з вимоги PM (`expected` — точні поля, `rubric` — слова PM).
- [ ] 1.3 Тести спершу (нова сесія агента): `suggestClosures` з `MockLanguageModelV4` — стани `ok`/`needs_info`/`refused`,
  відповідь не за схемою, неіснуюча дата, кінець раніше за початок, час не кратний 5, назва понад 100, 429 (також у тілі HTTP
  200), таймаут, немає ключа; межа `<document>` у промпті, вирізання тегів-меж; `tests/ai-key.test.ts` (`server-only`, жодного
  `NEXT_PUBLIC_`, ключ читає один файл).
- [ ] 1.4 `src/lib/ai/{schema,models,openrouter}.ts`, `prompts/calendar.ts`, `src/lib/calendar-assistant/{rules,suggest}.ts`,
  `vitest.eval.config.mts`, `scripts/{free-models,quota}.mjs` (адаптація набору курсу); модулі правил у `FLOORED`.
  Done when: AC-ASSIST-05, AC-ASSIST-06, AC-ASSIST-07, AC-ASSIST-09, AC-ASSIST-10 — unit-тести доменного рівня зелені без ключа й
  мережі; без перевірки правил (мутант) тест червоний; `npm test` не кличе модель.

## 2. Запит пропозицій: сторінка, дія, стани (AC-ASSIST-01, 05, 06, 07, 08, 09, 10, 11)

- [ ] 2.1 Тести спершу (нова сесія): дія `requestSuggestions` з фейковою моделлю (довжина → без виклику моделі; не-адмін →
  `ONLY_ADMIN_CALENDAR` без виклику; стани → дослівні повідомлення; нічого не пишеться в базу).
- [ ] 2.2 `/calendar/assistant` (`page.tsx`, `loading.tsx`), `assistant-form.tsx` («Preparing suggestions…», кнопка
  `disabled`, лічильник), `actions.ts:requestSuggestions` (`getClaims()` → роль → довжина → `productModel()`), повідомлення
  в `messages.ts`; посилання «Calendar assistant» для адміністратора.
  Done when: AC-ASSIST-01 (без збереження), 05, 06, 07, 08, 09, 10, 11 — тести дій зелені, сторінка працює без ключа
  (стан «недоступний», ручне додавання працює).

## 3. Перегляд і збереження пропозицій (AC-ASSIST-02, 03, 04)

- [ ] 3.1 Тести спершу (нова сесія): `saveSuggestions` на репозиторії з фейком/PGlite — збереження двох без змін, видалення й
  перейменування, часткове збереження при перетині (повідомлення `2026-12-28 is already closed: Winter break`).
- [ ] 3.2 Спільна `saveClosure` з `addClosure`; `saveSuggestions` (`getClaims()` + admin, повторна валідація, кожен рядок окремо);
  UI списку пропозицій: редагувати, видалити, «Save closures», результат по рядках.
  Done when: AC-ASSIST-02, AC-ASSIST-03, AC-ASSIST-04 — тести зелені; модель у цьому шляху не викликається.

## 4. Golden cases офлайн і тести збоїв

- [ ] 4.1 `tests/golden.test.ts`: `it.each` за кейсами, назви `"AC-ASSIST-NN: golden $id"`; тест «кожен кейс має запис,
  записаний поточною версією промпту»; тести збоїв (немає ключа, 429, 429 у тілі HTTP 200, таймаут, не за схемою →
  дослівний текст AC-ASSIST-09) і ін'єкції (AC-ASSIST-07).
  Done when: `npm test` і `npm run ac:coverage` зелені без ключа; до реального запису — заглушки, позначені як такі (`stub: true`); AC-ASSIST-01, 05, 06, 07, 09.

## 5. Живий eval і записи (робить людина)

- [ ] 5.1 `npm run ai:quota` → `$env:RECORD="1"; npm run eval`; звіт `evals/reports/<дата й час>.md` і справжній
  `recorded.json` у PR; розбір кожного FAIL одним рядком; зміна промпту → `CALENDAR_PROMPT_VERSION` + 1 і новий прогін.
  Done when: AC-ASSIST-01, 05, 06, 07: звіт з моделлю, pass rate, датою, версією промпту і поріг PM виконано (≥ 8 з 10, GC-08, GC-09,
  GC-10 завжди); якщо ні — змінюємо промпт (`CALENDAR_PROMPT_VERSION` + 1) і повторюємо (не більше двох прогонів на добу), а
  невиконаний поріг прямо виносимо у файл здачі (8.1) і в чат PM, а не вважаємо задачу закритою описом невдачі.

## 6. UAT на проді щонайменше на 2 AC

- [ ] 6.1 Специфікації Playwright: AC-ASSIST-11 (employee, без моделі) і AC-ASSIST-02 (адміністратор зберігає після перегляду);
  `@writes` з прибиранням створених закриттів у `afterEach` і teardown; прогін після 02:00 Київ (нова доба ліміту). Прод — наша
  демо-база з синтетичними акаунтами, реальних працівників у ній немає; закриття живе лише на час сценарію, як у WS9.
  Done when: AC-ASSIST-11 і AC-ASSIST-02 — специфікації написано, прогін на проді зелений.
- [ ] 6.2 Звіт `docs/qa/uat/<дата>/`, відео вкладенням у PR, рядки `docs/conformance.md`.
  Done when: щонайменше 2 AC мають рядок звіту UAT; `/api/health` = SHA `main`; `OPENROUTER_API_KEY` у Vercel Production.

## 7. AC-CAL-16…20

- [ ] 7.1 Тести (нова сесія) на AC-CAL-16, 17, 18, 19 за наявним кодом (`openBlocks`, `alreadyClosed`, `parseClosureForm`);
  AC-CAL-20 — перевірити баланс; доробка лише для того, що падає (AC-CAL-20 — можливо фіксування частки при погодженні:
  окремий ADR і міграція).
  Done when: AC-CAL-16, AC-CAL-17, AC-CAL-18, AC-CAL-19, AC-CAL-20 — кожен має тест із ID у назві або чесне «відкладено (причина)».

## 8. Здача

- [ ] 8.1 `docs/qa/proof-pack`-запис для зрізу 4, `docs/conformance.md`, архів `impl-calendar-assistant` в останньому PR;
  файл здачі `submissions/leave-portal/<login>.md` у репо курсу, PR `WS10: Lukian Tomochko`; «eval готовий» у чат команди —
  надсилає людина.
  Done when: AC-ASSIST-01…11 — рядок у conformance на кожен; поріг eval із 5.1 виконано або названо у файлі здачі; `npm run ac:coverage` зелений; PR здачі відкрито до кінця Пн 16.11.
