# Пропозиція: уточнення специфікації за відповіддю PM на питання про кінець відпустки на початку блоку

## Why

PM відповів на питання про AC-LEAVE-19 (mkozlovskyi-ops/course-staff-management-spec#21, варіант A) і змінив вимогу
`01-leave-request.md` комітом `a4ef0ec` (03.11): додано AC-LEAVE-22, а припущення уточнено — кінець відпустки може
дорівнювати початку наступного блоку розкладу, рахуються лише хвилини всередині блоків. Нова `/requirements-sync`
(коміт PM `818bad5`) принесла зміну в `requirements/`. Ця зміна приводить нашу специфікацію до вимоги PM.

Джерело (рядок `> Джерело:` у файлі `requirements/`):

- `requirements/01-leave-request.md` — <https://github.com/mkozlovskyi-ops/course-staff-management-spec/blob/818bad5c4c7521280fa59bb814b2317f92857eb2/docs/requirements/01-leave-request.md>

## What Changes

- **Кінець відпустки на початку наступного блоку** (mkozlovskyi-ops/course-staff-management-spec#21, рішення A): MODIFIED —
  «Години в межах розкладу» (кінець може дорівнювати кінцю блоку чи початку наступного, проміжок не рахується);
  ADDED — сценарій AC-LEAVE-22.

Нові AC: AC-LEAVE-22. Текст наявних AC не змінився. Прибраних AC немає.

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `leave-request`: кінець відпустки може дорівнювати початку наступного блоку розкладу.

## Users & roles

Без змін.

## Non-goals

Без змін відносно `add-leave-management`.

## Assumptions

Нове припущення PM (з'явилося у вимозі `requirements/01-leave-request.md` після відповіді):

- Початок і кінець відпустки мають припадати на блок розкладу; кінець може дорівнювати кінцю блоку або початку наступного блоку, рахуються лише хвилини всередині блоків (mkozlovskyi-ops/course-staff-management-spec#21).

Власні припущення (розробник): немає.

## Open questions

PM у вимозі вказує «None». Питань розробника, що чекають відповіді, у цій зміні немає.
