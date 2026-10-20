# Дельта: leave-balance

## MODIFIED Requirements

### Requirement: Цілий день у балансі

WHEN менеджер погоджує записи, що разом покривають усі робочі хвилини працівника цієї дати за розкладами всіх його посад, the system SHALL зарахувати 1.00 день, а цілий день лише однієї з кількох посад — її частку.

#### Scenario: AC-BALANCE-02 Погоджений цілий день

- **GIVEN** працівник із балансом "Sick leave" 18.00 і основною посадою з розкладом Tue 08:30–15:30
- **WHEN** менеджер погоджує запис "Sick leave" на цілий день 2026-11-03
- **THEN** використано 1.00, залишок 17.00

### Requirement: Попередження працівнику про перевищення залишку

WHEN працівник подає заявку, що перевищує його залишок, the system SHALL створити заявку й показати одне попередження за сумою всієї заявки про те, яка частина буде зарахована як "Unpaid leave".

#### Scenario: AC-BALANCE-08 Перевищення залишку на цілий день

- **GIVEN** працівник із балансом "Personal leave" 0.50 і посадою з розкладом Tue 08:30–15:30
- **WHEN** працівник подає заявку "Personal leave" на цілий день 2026-11-03
- **THEN** заявку створено
- **AND** працівник бачить попередження "Your Personal leave balance is 0.50 day. Another 0.50 day will be counted as Unpaid leave"

#### Scenario: AC-BALANCE-15 Перевищення залишку частиною дня

- **GIVEN** працівник, у якого "Personal leave" показує залишок 0.20, і єдина посада з розкладом Tue 08:30–15:30 (420 хв)
- **WHEN** працівник подає заявку "Personal leave" на 2026-11-03 з 09:00 до 11:30 (0.36 дня)
- **THEN** заявку створено
- **AND** працівник бачить попередження "Your Personal leave balance is 0.20 day. Another 0.16 day will be counted as Unpaid leave"

#### Scenario: AC-BALANCE-17 Одне попередження для заявки на кілька дат

- **GIVEN** працівник, у якого "Personal leave" показує залишок 1.50, і посада з розкладом Mon–Fri 08:30–15:30
- **WHEN** працівник подає заявку "Personal leave" на цілі дні 2026-11-02, 2026-11-03 і 2026-11-04 в одній заявці
- **THEN** заявку створено
- **AND** працівник бачить одне попередження "Your Personal leave balance is 1.50 day. Another 1.50 day will be counted as Unpaid leave"

### Requirement: Погодження з розподілом

WHEN менеджер погоджує запис із запропонованим розподілом, the system SHALL залишити один запис зі своїм типом відпустки, показати на ньому розподіл і зарахувати оплачувану частину до "Personal leave" до вичерпання залишку, а неоплачувану решту до "Unpaid leave".

#### Scenario: AC-BALANCE-10 Погодження із запропонованим розподілом

- **GIVEN** запис із AC-BALANCE-09 і "Unpaid leave" використано 0.00 у працівника
- **WHEN** менеджер погоджує запис із запропонованим розподілом
- **THEN** "Personal leave" — використано 18.00, залишок 0.00
- **AND** "Unpaid leave" — використано 0.50

#### Scenario: AC-BALANCE-18 Запис із розподілом лишається одним

- **GIVEN** запис із AC-BALANCE-10, погоджений із розподілом
- **WHEN** працівник відкриває "My requests"
- **THEN** є один запис із типом "Personal leave", статусом "Approved" і розподілом "0.50 Personal leave + 0.50 Unpaid leave"

#### Scenario: AC-BALANCE-19 Розподіл при нульовому залишку

- **GIVEN** запис "Personal leave" на цілий день зі статусом "Awaiting decision" працівника, у якого "Personal leave" показує залишок 0.00, а "Unpaid leave" використано 0.00
- **WHEN** менеджер погоджує його із запропонованим розподілом
- **THEN** запис зберігає тип "Personal leave" із розподілом "0.00 Personal leave + 1.00 Unpaid leave"
- **AND** "Unpaid leave" показує використано 1.00

### Requirement: Видимість балансів

IF баланси працівника намагається переглянути користувач, який не є ні самим цим працівником, ні менеджером хоча б однієї з його посад, ні адміністратором, THEN the system SHALL не показувати баланси.

#### Scenario: AC-BALANCE-12 Менеджер без посад працівника

- **GIVEN** працівник teacher1@example.test не має посад, якими керує manager1@example.test
- **WHEN** manager1@example.test намагається переглянути баланси teacher1@example.test
- **THEN** баланси не показано

#### Scenario: AC-BALANCE-13 Працівник не бачить чужих балансів

- **GIVEN** працівник teacher1@example.test
- **WHEN** teacher1@example.test намагається переглянути баланси іншого працівника
- **THEN** баланси не показано

## ADDED Requirements

### Requirement: Повний баланс для менеджера будь-якої посади

WHEN менеджер хоча б однієї з посад працівника переглядає баланси цього працівника, the system SHALL показати повний баланс — ті самі числа, що бачить сам працівник.

#### Scenario: AC-BALANCE-20 Менеджер додаткової посади бачить повний баланс

- **GIVEN** teacher1@example.test використав 2.00 дні "Personal leave" на основній посаді (manager1@example.test) і має додаткову посаду під керуванням manager2@example.test
- **WHEN** manager2@example.test переглядає баланси teacher1@example.test
- **THEN** "Personal leave" показує використано 2.00, залишок 16.00 — так само, як бачить teacher1@example.test
