# Attendee Reporting Specification

## Purpose
Organizer attendee list, CSV export and cash-up.

## Requirements

### Requirement: Attendee list [S1]
The owner MUST see tickets with status filters and search by name/email/code, plus dashboard stats by status.

#### Scenario: Filter
- GIVEN mixed statuses
- WHEN filtering pending_validation
- THEN only those tickets show

### Requirement: CSV export [S2]
The owner MUST export tickets with answers and status; staff MUST NOT. Cell values starting with `=`, `+`, `-`, `@` MUST be neutralized.

#### Scenario: Formula injection
- GIVEN an answer "=CMD()"
- WHEN exported
- THEN the cell is escaped as text

### Requirement: Cash-up summary [S2]
The owner MUST see totals and counts by payment method (SPEI/cash) for paid and checked_in tickets; rejected/pending excluded. Amounts in MXN.

#### Scenario: Totals
- GIVEN 2 SPEI and 1 cash paid tickets at 10000 cents
- THEN SPEI = 200.00 and cash = 100.00

#### Scenario: Staff access
- WHEN staff request the summary
- THEN access is denied
