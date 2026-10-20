# Дельта: leave-decision

## MODIFIED Requirements

### Requirement: Зміна годин до рішення

WHEN працівник змінює години запису зі статусом "Awaiting decision" у межах розкладу тієї самої посади на ту саму дату, the system SHALL зберегти нові години, лишити статус "Awaiting decision" і показати менеджеру нові години, не перевіряючи запис на перетин із ним самим.

#### Scenario: AC-DECIDE-16 Працівник змінює години до рішення

- **GIVEN** запис 2026-11-02 08:30–15:30 зі статусом "Awaiting decision"
- **WHEN** працівник змінює його години на 09:00–12:00
- **THEN** запис має години 09:00–12:00 і зберігає статус "Awaiting decision"
- **AND** менеджер бачить 09:00–12:00 у списку "Awaiting decision"

## ADDED Requirements

### Requirement: Коментар працівника для менеджера

WHEN менеджер відкриває запис заявки з коментарем працівника, the system SHALL показати цей коментар.

#### Scenario: AC-DECIDE-20 Менеджер бачить коментар працівника

- **GIVEN** запис заявки з коментарем "Doctor's appointment" і статусом "Awaiting decision"
- **WHEN** менеджер відкриває запис
- **THEN** менеджер бачить коментар "Doctor's appointment"

### Requirement: Лише години змінюються до рішення

IF працівник намагається до рішення змінити дату, посаду чи тип відпустки запису, THEN the system SHALL не зберегти зміну й показати повідомлення "Only the hours can be changed. To change the date, position or leave type, cancel this record and submit a new request".

#### Scenario: AC-DECIDE-21 Зміна типу відпустки заборонена

- **GIVEN** запис 2026-11-02 "Sick leave" зі статусом "Awaiting decision"
- **WHEN** працівник намагається змінити його тип відпустки на "Personal leave"
- **THEN** зміну не збережено
- **AND** працівник бачить повідомлення "Only the hours can be changed. To change the date, position or leave type, cancel this record and submit a new request"

### Requirement: Перетин під час зміни годин

IF нові години запису перетинаються з іншим записом тієї самої посади, THEN the system SHALL не зберегти зміну й показати повідомлення "You already have a request for this time: …" із датою й годинами іншого запису.

#### Scenario: AC-DECIDE-22 Зміна годин із перетином

- **GIVEN** два записи однієї посади на 2026-11-02, 08:30–10:00 і 13:00–15:30, обидва зі статусом "Awaiting decision"
- **WHEN** працівник змінює години другого запису на 09:00–15:30
- **THEN** зміну не збережено
- **AND** працівник бачить повідомлення "You already have a request for this time: 2026-11-02 08:30–10:00"
