# Registration Form Specification

## Purpose
Per-event custom form and public registration.

## Requirements

### Requirement: Form schema [S1]
The builder MUST support short text, long text, select, checkbox, number, phone. Email MUST be a fixed mandatory field and unique per event. Fields have stable ids.

#### Scenario: Required answer missing
- GIVEN a required field
- WHEN the attendee submits without it
- THEN registration is rejected with a field error

#### Scenario: Invalid email
- GIVEN email "abc"
- WHEN submitting
- THEN registration is rejected

### Requirement: Edit lock [S1]
Once tickets exist, the organizer MAY add fields and edit labels, and MUST NOT delete a field that has answers.

#### Scenario: Delete answered field
- GIVEN a field with at least one answer
- WHEN the organizer removes it
- THEN the save is rejected

#### Scenario: Add field
- GIVEN existing tickets
- WHEN a field is added
- THEN the save succeeds and old tickets are unaffected

### Requirement: Public registration [S1]
Registration MUST create exactly one ticket per email per event. Re-registering an existing email MUST NOT create a duplicate and MUST resend the existing ticket's link (receipt upload or ticket view).

#### Scenario: Duplicate email
- GIVEN a ticket exists for a@x.com
- WHEN a@x.com registers again
- THEN no new ticket is created and the link email is resent
