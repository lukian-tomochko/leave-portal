# Пропозиція: уточнення специфікації за відповідями PM на питання #9–#11

## Why

Наші питання до PM (mkozlovskyi-ops/course-staff-management-spec#9, mkozlovskyi-ops/course-staff-management-spec#10,
mkozlovskyi-ops/course-staff-management-spec#11) закрито рішеннями PM. Він змінив усі три вимоги комітом `ea4bb85`:
AC стало 67 замість 62. Нова `/requirements-sync` (коміт PM `ea4bb85`, PR «Оновлення вимог» злито) принесла ці зміни в
`requirements/`. Ця зміна приводить нашу специфікацію до вимог PM: переклад 5 нових AC і оновлення вимог, яких
стосуються рішення.

Джерела (рядок `> Джерело:` у файлах `requirements/`):

- `requirements/01-leave-request.md` — <https://github.com/mkozlovskyi-ops/course-staff-management-spec/blob/ea4bb85c4d26d049217bce4a36669f6fd7682860/docs/requirements/01-leave-request.md>
- `requirements/02-leave-decision.md` — <https://github.com/mkozlovskyi-ops/course-staff-management-spec/blob/ea4bb85c4d26d049217bce4a36669f6fd7682860/docs/requirements/02-leave-decision.md>
- `requirements/03-leave-balance.md` — <https://github.com/mkozlovskyi-ops/course-staff-management-spec/blob/ea4bb85c4d26d049217bce4a36669f6fd7682860/docs/requirements/03-leave-balance.md>

## What Changes

За рішеннями PM (кожне — у відповіді на відповідне issue в репо PM):

- **Дата без годин у заявці на кілька дат** (mkozlovskyi-ops/course-staff-management-spec#9, рішення A): MODIFIED —
  «Дата без робочих годин» (дату не приймають, інші дати лишаються в заявці) і «Заявка зберігається цілою» («все або
  нічого» стосується прийнятих дат); ADDED — сценарій AC-LEAVE-21.
- **Коментар менеджера при відхиленні й погодженні** (mkozlovskyi-ops/course-staff-management-spec#10, рішення A):
  MODIFIED — «Відхилення запису» і «Погодження запису» (необов'язковий коментар менеджера, працівник бачить його в «My
  requests»); ADDED — сценарії AC-DECIDE-23 і AC-DECIDE-24. Повернення на доопрацювання без змін: коментар обов'язковий
  (AC-DECIDE-04, AC-DECIDE-05); AC-DECIDE-03 без змін.
- **Навчальний рік запису з минулою датою** (mkozlovskyi-ops/course-staff-management-spec#11, рішення A): ADDED —
  вимога «Запис зменшує баланс навчального року своєї дати» зі сценаріями AC-BALANCE-21 (пізнє погодження за минулий
  рік) і AC-BALANCE-22 (заявка на два навчальні роки).

Нові AC: AC-LEAVE-21, AC-DECIDE-23, AC-DECIDE-24, AC-BALANCE-21, AC-BALANCE-22. Текст 62 наявних AC не змінився.
Прибраних AC немає.

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `leave-request`: дата без робочих годин відкидається, а решта дат заявки лишається; «все або нічого» діє для прийнятих дат.
- `leave-decision`: необов'язковий коментар менеджера при відхиленні й погодженні, працівник бачить його в «My requests».
- `leave-balance`: запис зменшує баланс навчального року своєї дати, незалежно від дня погодження.

## Users & roles

Без змін.

## Non-goals

Без змін відносно `add-leave-management`.

## Assumptions

Нові припущення PM (вони з'явилися у вимогах `requirements/` після відповідей):

- Дата без робочих годин не приймається (AC-LEAVE-06), а інші дати заявки лишаються; «все або нічого» діє для прийнятих дат (mkozlovskyi-ops/course-staff-management-spec#9).
- Коментар менеджера обов'язковий при поверненні на доопрацювання й необов'язковий при погодженні та відхиленні; працівник бачить його в «My requests»; відхилення без коментаря працює, як в AC-DECIDE-03 (mkozlovskyi-ops/course-staff-management-spec#10).
- Запис зменшує баланс навчального року, до якого належить його дата, коли б його не погодили; пізнє погодження за минулий рік зменшує й перенесені дні наступного року; заявка на два навчальні роки дає записи в кожному з них (mkozlovskyi-ops/course-staff-management-spec#11).

Власні припущення (розробник): немає.

## Open questions

PM у вимогах вказує «None». Питань розробника, що чекають відповіді, немає: відповіді на питання Q1–Q3
(mkozlovskyi-ops/course-staff-management-spec#9, mkozlovskyi-ops/course-staff-management-spec#10,
mkozlovskyi-ops/course-staff-management-spec#11) отримано й враховано вище.
