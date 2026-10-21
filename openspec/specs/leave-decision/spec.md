# leave-decision Specification

## Purpose
Рішення менеджера по кожному запису відпустки своїх посад — погодити, відхилити чи повернути на доопрацювання —
рішення адміністратора, історія рішень і дії працівника над власним записом.

## Requirements

### Requirement: Черга менеджера

WHEN менеджер відкриває список "Awaiting decision", the system SHALL показати лише записи посад, за які він відповідає.

#### Scenario: AC-DECIDE-01 Менеджер бачить лише записи своєї посади

- **GIVEN** працівник з основною посадою (менеджер manager1@example.test) і додатковою посадою (менеджер manager2@example.test) подав заявку на цілий день з обома посадами
- **WHEN** manager1@example.test відкриває список "Awaiting decision"
- **THEN** список містить запис основної посади цього працівника
- **AND** список не містить запису додаткової посади

### Requirement: Порожня черга

IF у менеджера немає записів зі статусом "Awaiting decision", THEN the system SHALL показати повідомлення "No records awaiting decision".

#### Scenario: AC-DECIDE-14 Порожній список

- **GIVEN** менеджер має 0 записів зі статусом "Awaiting decision"
- **WHEN** менеджер відкриває список "Awaiting decision"
- **THEN** менеджер бачить повідомлення "No records awaiting decision"

### Requirement: Погодження запису

WHEN менеджер погоджує запис, the system SHALL встановити цьому запису статус "Approved", не змінювати інші записи заявки й показати працівнику в "My requests" необов'язковий коментар менеджера.

#### Scenario: AC-DECIDE-02 Погодження одного з двох записів

- **GIVEN** заявка з 2 записами зі статусом "Awaiting decision"
- **WHEN** менеджер погоджує один із них
- **THEN** цей запис має статус "Approved"
- **AND** інший запис лишається "Awaiting decision"

#### Scenario: AC-DECIDE-24 Погодження з коментарем

- **GIVEN** запис зі статусом "Awaiting decision"
- **WHEN** менеджер погоджує його з коментарем "Get well soon"
- **THEN** запис має статус "Approved"
- **AND** працівник бачить коментар "Get well soon" у "My requests"

### Requirement: Відхилення запису

WHEN менеджер відхиляє запис, the system SHALL встановити йому статус "Rejected" і показати цей статус працівнику в "My requests" разом з необов'язковим коментарем менеджера.

#### Scenario: AC-DECIDE-03 Відхилення запису

- **GIVEN** запис зі статусом "Awaiting decision"
- **WHEN** менеджер відхиляє його
- **THEN** запис має статус "Rejected"
- **AND** працівник бачить цей статус у "My requests"

#### Scenario: AC-DECIDE-23 Відхилення з коментарем

- **GIVEN** запис зі статусом "Awaiting decision"
- **WHEN** менеджер відхиляє його з коментарем "Not enough staff that day"
- **THEN** запис має статус "Rejected"
- **AND** працівник бачить коментар "Not enough staff that day" у "My requests"

### Requirement: Повернення без коментаря

IF менеджер повертає запис на доопрацювання без коментаря, THEN the system SHALL не змінювати статус запису й показати повідомлення "Tell the employee what to fix".

#### Scenario: AC-DECIDE-04 Повернення без коментаря

- **GIVEN** запис зі статусом "Awaiting decision"
- **WHEN** менеджер повертає його на доопрацювання без коментаря
- **THEN** статус не змінюється
- **AND** менеджер бачить повідомлення "Tell the employee what to fix"

### Requirement: Повернення з коментарем

WHEN менеджер повертає запис на доопрацювання з коментарем, the system SHALL встановити запису статус "Returned for revision" і показати коментар працівнику.

#### Scenario: AC-DECIDE-05 Повернення з коментарем

- **GIVEN** запис зі статусом "Awaiting decision"
- **WHEN** менеджер повертає його на доопрацювання з коментарем "Enter hours instead of a whole day"
- **THEN** запис має статус "Returned for revision"
- **AND** працівник бачить на ньому коментар "Enter hours instead of a whole day"

### Requirement: Повторна подача повернутого запису

WHEN працівник змінює години повернутого запису й подає його знову, the system SHALL встановити запису статус "Awaiting decision" і повернути його в список "Awaiting decision" тих самих менеджерів.

#### Scenario: AC-DECIDE-06 Виправлення й повторна подача

- **GIVEN** запис зі статусом "Returned for revision"
- **WHEN** працівник змінює години з 08:30–15:30 на 09:00–12:00 і подає запис повторно
- **THEN** запис має години 09:00–12:00 і статус "Awaiting decision"
- **AND** запис знову в списку "Awaiting decision" того самого менеджера

### Requirement: Рішення першого з кількох менеджерів

IF запис посади з двома відповідальними менеджерами вже погодив один із них, THEN the system SHALL не приймати рішення іншого менеджера й показати повідомлення "Another manager has already decided: Approved".

#### Scenario: AC-DECIDE-07 Другий менеджер запізнився

- **GIVEN** посада має 2 відповідальних менеджерів, і обидва бачать її запис зі статусом "Awaiting decision"
- **WHEN** перший менеджер погоджує запис, а другий потім намагається його відхилити
- **THEN** запис лишається "Approved"
- **AND** другий менеджер бачить повідомлення "Another manager has already decided: Approved"

### Requirement: Рішення лише відповідального менеджера або адміністратора

IF рішення намагається ухвалити користувач, який не є ні відповідальним менеджером посади запису, ні адміністратором, THEN the system SHALL не змінювати статус запису й не зберігати рішення.

#### Scenario: AC-DECIDE-08 Менеджер чужої посади

- **GIVEN** manager2@example.test не відповідає за основну посаду працівника
- **WHEN** manager2@example.test намагається погодити запис цієї посади
- **THEN** статус не змінюється
- **AND** рішення не зберігається

#### Scenario: AC-DECIDE-09 Працівник без ролі менеджера чи адміністратора

- **GIVEN** працівник без ролі manager чи admin
- **WHEN** цей працівник намагається погодити власний запис
- **THEN** статус не змінюється
- **AND** рішення не зберігається

### Requirement: Рішення адміністратора

WHEN адміністратор вирішує запис посади, за яку не відповідає, the system SHALL застосувати рішення й зберегти в історії запису, що його ухвалив адміністратор.

#### Scenario: AC-DECIDE-10 Адміністратор погоджує чужий запис

- **GIVEN** запис зі статусом "Awaiting decision" посади, за яку адміністратор не є відповідальним менеджером
- **WHEN** адміністратор погоджує цей запис
- **THEN** запис має статус "Approved"
- **AND** в історії запису видно, що рішення ухвалив адміністратор

### Requirement: Власний запис менеджера

IF менеджер намагається вирішити власний запис, THEN the system SHALL не змінювати статус запису й показати повідомлення "Your own record is decided by an administrator".

#### Scenario: AC-DECIDE-18 Менеджер не погоджує власний запис

- **GIVEN** manager1@example.test — відповідальний менеджер власної основної посади й має власний запис зі статусом "Awaiting decision"
- **WHEN** manager1@example.test намагається погодити цей запис
- **THEN** статус не змінюється
- **AND** manager1@example.test бачить повідомлення "Your own record is decided by an administrator"

### Requirement: Рішення адміністратора щодо запису менеджера

WHEN адміністратор погоджує власний запис менеджера, the system SHALL встановити запису статус "Approved".

#### Scenario: AC-DECIDE-19 Адміністратор погоджує запис менеджера

- **GIVEN** запис із AC-DECIDE-18
- **WHEN** адміністратор погоджує його
- **THEN** запис має статус "Approved"

### Requirement: Перехід рішеного запису в історію

WHEN менеджер вирішує запис, the system SHALL прибрати його зі списку "Awaiting decision" і показати в "History" менеджера.

#### Scenario: AC-DECIDE-11 Погоджений запис іде в історію

- **GIVEN** список "Awaiting decision" менеджера має 3 записи
- **WHEN** менеджер погоджує 1 із них
- **THEN** у "Awaiting decision" лишається 2 записи
- **AND** погоджений запис у "History" менеджера

### Requirement: Історія рішення запису

WHEN працівник чи будь-який відповідальний менеджер посади переглядає історію погодженого запису, the system SHALL показати рядок із датою й часом рішення, хто вирішив і рішенням "Approved".

#### Scenario: AC-DECIDE-15 Рядок історії погодженого запису

- **GIVEN** менеджер погодив запис
- **WHEN** працівник або будь-який відповідальний менеджер посади переглядає історію запису
- **THEN** в історії є рядок: дата й час рішення, хто вирішив, рішення "Approved"

### Requirement: Погоджений запис не змінюється працівником

IF працівник намагається змінити години запису зі статусом "Approved", THEN the system SHALL не зберігати зміну й показати повідомлення "This record is already approved and cannot be changed".

#### Scenario: AC-DECIDE-12 Зміна погодженого запису

- **GIVEN** запис зі статусом "Approved"
- **WHEN** працівник намагається змінити його години
- **THEN** зміну не збережено
- **AND** працівник бачить повідомлення "This record is already approved and cannot be changed"

### Requirement: Зміна годин до рішення

WHEN працівник змінює години запису зі статусом "Awaiting decision" у межах розкладу тієї самої посади на ту саму дату, the system SHALL зберегти нові години, лишити статус "Awaiting decision" і показати менеджеру нові години, не перевіряючи запис на перетин із ним самим.

#### Scenario: AC-DECIDE-16 Працівник змінює години до рішення

- **GIVEN** запис 2026-11-02 08:30–15:30 зі статусом "Awaiting decision"
- **WHEN** працівник змінює його години на 09:00–12:00
- **THEN** запис має години 09:00–12:00 і зберігає статус "Awaiting decision"
- **AND** менеджер бачить 09:00–12:00 у списку "Awaiting decision"

### Requirement: Скасування запису працівником

WHEN працівник скасовує власний запис зі статусом "Awaiting decision" або "Returned for revision", the system SHALL встановити запису статус "Cancelled" і виключити його з повторної подачі та зі списку "Awaiting decision" менеджера.

#### Scenario: AC-DECIDE-13 Скасування запису на розгляді

- **GIVEN** запис зі статусом "Awaiting decision"
- **WHEN** працівник скасовує його
- **THEN** запис має статус "Cancelled"
- **AND** запис зникає зі списку "Awaiting decision" менеджера

#### Scenario: AC-DECIDE-17 Скасування повернутого запису

- **GIVEN** запис зі статусом "Returned for revision"
- **WHEN** працівник скасовує його
- **THEN** запис має статус "Cancelled"
- **AND** його не можна повторно подати

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
