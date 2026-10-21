## MODIFIED Requirements

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
