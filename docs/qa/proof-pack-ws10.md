# QA proof pack: зріз 4 — помічник календаря (AI-функція, WS10) і AC-CAL-16…20 (leave-portal)

<!--
Зріз 3 — docs/qa/proof-pack.md, WS8 — docs/qa/proof-pack-ws8.md. Лише перевірені факти: що не перевірено, названо нижче.
Посилання на файли — на коміт `16a0ac9` (main на 27.11.2026). Жодних паролів, ключів і пароля від accounts.zip.
-->

- Прод-URL: https://leave-portal-blush.vercel.app
- Зріз 4: адміністратор вставляє текст шкільного календаря (до 2000 символів), помічник (LLM) пропонує закриття, людина редагує й зберігає; модель нічого не пише в базу. Плюс AC-CAL-16…20 вимоги 04.
- Вимоги: https://github.com/mkozlovskyi-ops/course-staff-management-spec · джерело: docs · знімок 2026-11-15
- Спека: [calendar-assistant](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/openspec/specs/calendar-assistant/spec.md) (AC-ASSIST) і [leave-balance](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/openspec/specs/leave-balance/spec.md) (AC-CAL-20)
- `/api/health` на момент UAT (16.11.2026, 10:46 за Києвом): коміт `449975b`, db ok; на 27.11.2026: `16a0ac9`, db ok

## Доказ на кожен AC зрізу 4

Рівні: unit (Vitest), golden (офлайн-відтворення записаних відповідей моделі, `tests/golden.test.ts`), e2e/UAT (Playwright на проді). Вердикт і кадр — зі [звіту UAT 16.11](uat/2026-11-16/report.md) (правила R1–R6). Модель у CI ніколи не викликається.

| AC | Вид | Тест (рівень) | Здатен упасти | UAT |
|---|---|---|---|---|
| AC-ASSIST-01 | основний (два закриття, нічого не збережено) | [suggest.test.ts](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/src/lib/calendar-assistant/suggest.test.ts), [actions.test.ts](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/src/app/calendar/assistant/actions.test.ts), golden GC-01…GC-05 | так (мутанти M1–M4 нижче, частково) | PASS (R6) |
| AC-ASSIST-02 | основний (збереження двох) | [actions.test.ts](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/src/app/calendar/assistant/actions.test.ts) (в т. ч. підроблений рядок відхиляється) | перевірки на сервері, повторна валідація | PASS (R6) |
| AC-ASSIST-03 | основний (редагування й видалення) | actions.test.ts | — | немає (тест дій) |
| AC-ASSIST-04 | відмова частково (одна вже закрита) | actions.test.ts: зберігається решта, повідомлення `is already closed` | — | немає (тест дій) |
| AC-ASSIST-05 | стан (needs_info) | suggest.test.ts, golden GC-06, GC-07 | M2: `needs_info` із закриттями — тести червоні | немає |
| AC-ASSIST-06 | відмова моделі (вірш) | suggest.test.ts, golden GC-08, GC-10 | M2: `refused` із закриттями — тести червоні | немає |
| AC-ASSIST-07 | ін'єкція в тексті | suggest.test.ts (межа `<document>`), golden (GC-09) | межа тексту й вирізання тегів у тестах | немає |
| AC-ASSIST-08 | очікування відповіді | e2e [assistant.spec.ts](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/tests/e2e/assistant.spec.ts) | лише e2e | PASS (R6) |
| AC-ASSIST-09 | збій чи ліміт (429, таймаут, не за схемою) | suggest.test.ts, actions.test.ts | M1, M3, M4: правила після моделі — тести червоні | немає |
| AC-ASSIST-10 | текст із 2001 символу | suggest.test.ts, actions.test.ts, e2e | довжина перевіряється до моделі | PASS (R6) |
| AC-ASSIST-11 | працівник відкриває помічника | actions.test.ts, e2e | перевірка ролі в дії до моделі | PASS (R6) |
| AC-CAL-16…19 | відмови форми закриття | [closures.test.ts](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/src/lib/leave/closures.test.ts), [calendar-admin.test.ts](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/src/lib/leave/calendar-admin.test.ts) | тести з дослівними текстами | немає |
| AC-CAL-20 | основний (частка дня не змінюється) | [balance.test.ts](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/src/lib/leave/balance.test.ts), [decide-balance.test.ts](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/src/lib/leave/decide-balance.test.ts), база [leave-balance.test.ts](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/tests/db/leave-balance.test.ts) | ігнорування знімка в `approvedPart` червонить 3 тести, знаменник без закриттів в `approvalSnapshot` — 3 тести ([#97](https://github.com/lukian-tomochko/leave-portal/pull/97)) | немає (UAT на staging — вручну) |

Підсумок UAT 16.11: 5 AC (AC-ASSIST-01, 02, 08, 10, 11) — PASS 5, FAIL 0, NEEDS-HUMAN 0; прибирання: синтетичних записів лишилось 0.

### Мутанти правил після моделі (27.11.2026, `src/lib/calendar-assistant/rules.ts`)

| Мутант | Червоні тести |
|---|---|
| M1: «ok без закриттів» дозволено | 1 (AC-ASSIST-09) |
| M2: `needs_info` і `refused` із закриттями дозволено | 2 (AC-ASSIST-09) |
| M3: скорочений день на кілька дат дозволено | 1 (AC-ASSIST-09) |
| M4: правила ручної форми (існування дати, кінець не раніше початку, час кратний 5) пропущено | 4 |

Після кожного мутанта файл відновлено; 50 тестів зрізу зелені.

## Eval (живий, 16.11.2026, промпт `calendar-v1`)

- Звіти: [2026-11-16T08-28-16-158Z.md](../../evals/reports/2026-11-16T08-28-16-158Z.md), [2026-11-16T08-30-48-953Z.md](../../evals/reports/2026-11-16T08-30-48-953Z.md), підсумок з поясненням кожного FAIL і NOT RUN: [SUMMARY-2026-11-16.md](../../evals/reports/SUMMARY-2026-11-16.md).
- Результат за двома прогонами: 10 з 10 кейсів; GC-08, GC-09, GC-10 пройшли (поріг PM ≥ 8 з 10 і ці три — виконано). У прогоні 1: GC-02 — FAIL (`invalid_output`), GC-09 і GC-10 — NOT RUN (429 від OpenRouter); повтор лише цих трьох у прогоні 2 пройшов.
- Витрачено близько 11 з 50 безкоштовних запитів доби; `tests/fixtures/golden/recorded.json` — справжні записи (без заглушок).

## Не перевірено

| Що | Чому | Що зроблено замість | Ризик |
|---|---|---|---|
| AC-ASSIST-03, 04: UAT на проді | у UAT взято AC-ASSIST-01, 02, 08, 10, 11 (поріг «щонайменше 2», з розбором кожного) | тести дій, повідомлення дослівні | низький |
| AC-ASSIST-05, 06, 07, 09 на живій моделі після 16.11 | безкоштовні моделі недетерміновані, ліміт 50/добу спільний із UAT і приймання PM | golden-відтворення записаних відповідей і живий eval 16.11 | відповідь моделі може змінитись; код правил однаково відхилить хибну форму |
| Мутанти для UI-частини (`assistant-panel.tsx`) | Stryker не запускали на компонентах | e2e (UAT PASS) | низький |
| AC-CAL-20: UAT на проді | вимога змінила схему 27.11; перевірка вручну на staging за кроками в описі [#97](https://github.com/lukian-tomochko/leave-portal/pull/97) | unit, база (PGlite), мутанти | записи, погоджені до міграції, не мають знімка (ADR 0012) |
| Питання PM [#28](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/28) (другий запис після закриття) | відповіді немає | робоче рішення 0.36 + 0.29 = 0.65 в ADR 0012 | може потребувати нової міграції |

## A. Вимоги й спека

- `/requirements-sync`: [#71](https://github.com/lukian-tomochko/leave-portal/pull/71) (знімок 15.11, зріз 4 і AC-CAL-16…20).
- Специфікація й план `impl-calendar-assistant`: [#72](https://github.com/lukian-tomochko/leave-portal/pull/72).
- Власних питань до PM для зрізу 4 не було («Open questions: None»); питання іншого розробника враховано в `docs/spec-reading.md` ([#27](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/27), [#28](https://github.com/mkozlovskyi-ops/course-staff-management-spec/issues/28)).

## B. Реалізація

| PR | Що |
|---|---|
| [#73](https://github.com/lukian-tomochko/leave-portal/pull/73), [#74](https://github.com/lukian-tomochko/leave-portal/pull/74) | помічник календаря: схема, правила, промпт, сторінка, дії, збереження, golden, AC-CAL-16…19 |
| [#75](https://github.com/lukian-tomochko/leave-portal/pull/75), [#76](https://github.com/lukian-tomochko/leave-portal/pull/76) | UAT на проді (AC-ASSIST-01, 02, 08, 10, 11) і виправлення очікування AC-ASSIST-08 |
| [#97](https://github.com/lukian-tomochko/leave-portal/pull/97) | AC-CAL-20: частка дня фіксується при погодженні, ADR 0012, міграція |

- ADR: [0010 (AI-функція, OpenRouter)](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/docs/decisions/0010-ai-feature-openrouter.md), [0012 (частка дня)](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/docs/decisions/0012-fixed-day-share-at-approval.md).
- Ключ `OPENROUTER_API_KEY` лише на сервері (`src/lib/ai/openrouter.ts`, `server-only`), перевіряє `tests/ai-key.test.ts`.

## C. UAT на проді

- Звіт: [docs/qa/uat/2026-11-16/report.md](uat/2026-11-16/report.md); кадри поруч у `frames/`.
- Приймання PM: очікується (оцінки PM і коментар-підпис — у PR зі звітом).

## D. Прод і здача

- `/api/health` після злиття #97: sha `16a0ac9`, db ok; міграція `20261127090000_fixed_day_share.sql` застосована через CI в staging і прод.
- Здача WS10: [PR у репо курсу](https://github.com/koldovsky/2026-quitcode-10-ai-features-hw/pull/3) (відкрито 16.11.2026, 09:28 UTC).
- `docs/conformance.md`: [conformance.md](https://github.com/lukian-tomochko/leave-portal/blob/16a0ac93f7d550e4f8b1583c4ddd17b8048056b1/docs/conformance.md) — 99 з 99 AC «реалізовано».
