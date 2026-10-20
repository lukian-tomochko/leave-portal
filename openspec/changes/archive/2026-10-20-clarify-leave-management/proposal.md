# Пропозиція: уточнення специфікації за відповідями PM на питання #1–#8

## Why

Після нашого першого знімка вимог (коміт PM `031e169`) PM відповів на питання розробників у своєму репо
(mkozlovskyi-ops/course-staff-management-spec#1–#8) і змінив усі три вимоги комітами `5e95269` і `a7e5940`: AC стало
62 замість 51. Нова `/requirements-sync` (коміт PM `a7e5940`) принесла ці зміни в `requirements/`. Ця зміна приводить
нашу специфікацію до вимог PM: переклад 11 нових AC і оновлення вимог, яких стосуються відповіді.

Джерела (рядок `> Джерело:` у файлах `requirements/`):

- `requirements/01-leave-request.md` — <https://github.com/mkozlovskyi-ops/course-staff-management-spec/blob/a7e59405cfd8f2a60a0de7e43691eee15acf89c4/docs/requirements/01-leave-request.md>
- `requirements/02-leave-decision.md` — <https://github.com/mkozlovskyi-ops/course-staff-management-spec/blob/a7e59405cfd8f2a60a0de7e43691eee15acf89c4/docs/requirements/02-leave-decision.md>
- `requirements/03-leave-balance.md` — <https://github.com/mkozlovskyi-ops/course-staff-management-spec/blob/a7e59405cfd8f2a60a0de7e43691eee15acf89c4/docs/requirements/03-leave-balance.md>

## What Changes

За рішеннями PM (кожне — у відповіді на відповідне issue в репо PM):

- **Коментар до заявки** (mkozlovskyi-ops/course-staff-management-spec#1, рішення A): ADDED — коментар до заявки й
  його довжина до 500 символів (AC-LEAVE-17, AC-LEAVE-18); менеджер бачить коментар (AC-DECIDE-20).
- **Що працівник змінює до рішення** (mkozlovskyi-ops/course-staff-management-spec#2, рішення A + A1): MODIFIED —
  «Зміна годин до рішення» (лише години, запис не перевіряється на перетин із самим собою) і «Перетин із наявним
  записом»; ADDED — зміна типу заборонена (AC-DECIDE-21), перетин під час зміни годин (AC-DECIDE-22).
- **Попередження на кілька дат** (mkozlovskyi-ops/course-staff-management-spec#3, рішення A): MODIFIED — «Попередження
  працівнику про перевищення залишку» (одне попередження за сумою заявки); сценарій AC-BALANCE-17.
- **Запис після розподілу** (mkozlovskyi-ops/course-staff-management-spec#4, рішення A): MODIFIED — «Погодження з
  розподілом» (запис лишається одним, розподіл показано на ньому); сценарії AC-BALANCE-18 і AC-BALANCE-19 (нульовий залишок).
- **Повідомлення для кількох блоків розкладу** (mkozlovskyi-ops/course-staff-management-spec#5, рішення A): MODIFIED —
  «Години поза розкладом» (повідомлення перелічує всі блоки дня) і «Початок збігається з кінцем блоку»; сценарії
  AC-LEAVE-19 і AC-LEAVE-20.
- **Баланс для менеджера додаткової посади** (mkozlovskyi-ops/course-staff-management-spec#6, рішення A): ADDED —
  повний баланс для менеджера будь-якої посади (AC-BALANCE-20); MODIFIED — «Видимість балансів».
- **Частка дня** (mkozlovskyi-ops/course-staff-management-spec#7): MODIFIED — «Цілий день у балансі» (формула є правилом;
  цілий день однієї з кількох посад дає її частку); AC без змін.
- **Розклади посад не перетинаються** (mkozlovskyi-ops/course-staff-management-spec#8, рішення C): лише припущення; AC
  без змін.

Нові AC: AC-LEAVE-17, AC-LEAVE-18, AC-LEAVE-19, AC-LEAVE-20, AC-DECIDE-20, AC-DECIDE-21, AC-DECIDE-22, AC-BALANCE-17,
AC-BALANCE-18, AC-BALANCE-19, AC-BALANCE-20. Текст 51 наявного AC не змінився. Прибраних AC немає.

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `leave-request`: коментар до заявки; повідомлення про години поза розкладом з кількох блоків; перетин не враховує запис, який редагують.
- `leave-decision`: коментар працівника для менеджера; до рішення змінюються лише години; перетин під час зміни годин.
- `leave-balance`: одне попередження на всю заявку; розподіл лишає один запис; повний баланс для менеджера будь-якої посади; частка дня.

## Users & roles

Без змін, крім одного: відповідальний менеджер (`manager`) бачить повні баланси працівників, у яких є хоча б одна
його посада, ті самі числа, що бачить сам працівник (mkozlovskyi-ops/course-staff-management-spec#6). Записи
посад, якими він не керує, він і далі не бачить (AC-DECIDE-01).

## Non-goals

Без змін відносно `add-leave-management`.

## Assumptions

Нові припущення PM (вони з'явилися у вимогах `requirements/` після відповідей):

- Працівник може додати до заявки один необов'язковий коментар до 500 символів; він зберігається на кожному записі заявки (mkozlovskyi-ops/course-staff-management-spec#1).
- Коли години поза розкладом, повідомлення перелічує всі блоки цього дня через ", " у хронологічному порядку (mkozlovskyi-ops/course-staff-management-spec#5).
- Запис, який редагують, не перевіряється на перетин із самим собою, лише з іншими записами посади (mkozlovskyi-ops/course-staff-management-spec#2).
- До рішення працівник змінює лише години запису в межах розкладу тієї самої посади на ту саму дату; щоб змінити дату, посаду чи тип відпустки, він скасовує запис і подає нову заявку (mkozlovskyi-ops/course-staff-management-spec#2).
- Частка дня — хвилини запису ÷ усі робочі хвилини працівника цієї дати за всіма посадами; записи, що разом покривають усі ці хвилини, дають 1.00 день, а цілий день лише однієї з кількох посад — її частку (mkozlovskyi-ops/course-staff-management-spec#7).
- Розклади посад однієї людини ніколи не перетинаються; їх підтримує адміністратор (зріз WS10), тестові дані створюємо без перетинів (mkozlovskyi-ops/course-staff-management-spec#8).
- Попередження працівнику — одне на всю заявку за сумою; запис, погоджений із розподілом, лишається одним записом зі своїм типом, розподіл показано на ньому й враховано в балансах обох типів (mkozlovskyi-ops/course-staff-management-spec#3, mkozlovskyi-ops/course-staff-management-spec#4).
- Відповідальний менеджер будь-якої з посад працівника бачить його повний баланс (mkozlovskyi-ops/course-staff-management-spec#6).

Власні припущення (розробник): немає.

## Open questions

PM у вимогах вказує «None». Питання розробника до PM (відповідей ще немає, у специфікації лишається робоче припущення):

- Q1. Що робить заявка на кілька дат, якщо на одну з них немає робочих годин (AC-LEAVE-06)? Робоче припущення — цю дату не приймають із повідомленням, інші дати лишаються в заявці. mkozlovskyi-ops/course-staff-management-spec#9.
- Q2. Чи може менеджер залишити коментар при відхиленні чи погодженні, і чи обов'язковий він (AC-DECIDE-03)? Робоче припущення — як у PM: коментар лише при поверненні. mkozlovskyi-ops/course-staff-management-spec#10.
- Q3. Залишок якого навчального року зменшує запис з датою в минулому році, погоджений після 1 вересня (AC-BALANCE-11)? Робоче припущення — року, до якого належить дата запису. mkozlovskyi-ops/course-staff-management-spec#11.
