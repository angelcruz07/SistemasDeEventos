# Event Ticketing Config Specification

## Purpose
Per-event price, payment methods, SPEI details, capacity and registration toggle. All times display in America/Mexico_City.

## Requirements

### Requirement: Slug stability on edit [S0]
The system MUST NOT change an event's slug when the event is edited.

#### Scenario: Edit title
- GIVEN an event with slug `fiesta-x` and a shared link
- WHEN the organizer changes the title and saves
- THEN the slug remains `fiesta-x` and the link still resolves

### Requirement: Editing past events [S0]
The system MUST allow the organizer to edit or cancel an event whose date/time is today or past.

#### Scenario: Edit after start
- GIVEN an event that started 1 hour ago
- WHEN the organizer saves a change
- THEN the save succeeds

### Requirement: Price and payment methods [S1]
The event MUST have a price (integer cents, >= 0) and toggles for SPEI and cash. Public pages MUST only offer SPEI. SPEI details (CLABE, bank, beneficiary) MUST be per event; the transfer concept is the ticket short code.

#### Scenario: Publish blocked
- GIVEN price > 0 and neither SPEI nor cash enabled
- WHEN the organizer publishes
- THEN publishing is rejected with an error

#### Scenario: Free event
- GIVEN price 0
- WHEN the organizer publishes with no payment method
- THEN publishing succeeds and no payment step is shown

#### Scenario: SPEI incomplete
- GIVEN SPEI enabled and CLABE missing
- WHEN saving
- THEN the save is rejected

### Requirement: Capacity and registration toggle [S1]
The event MAY have an internal capacity (never shown publicly) and MUST have a `registrationOpen` toggle. Only tickets in pending_validation, paid, checked_in hold a spot; pending_receipt, rejected, cancelled do not. A separate public display number MAY differ from capacity.

#### Scenario: Capacity reached
- GIVEN capacity 100 and 100 holding tickets
- WHEN a visitor tries to register
- THEN registration is refused as full

#### Scenario: Rejection frees spot
- GIVEN capacity reached, then one ticket is rejected
- WHEN a new visitor registers
- THEN registration succeeds

#### Scenario: Registration closed
- GIVEN `registrationOpen` is false
- WHEN a visitor submits the form
- THEN it is refused and no ticket is created
