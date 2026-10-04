# Ticket Lifecycle Specification

## Purpose
Ticket statuses and transitions replacing RSVP.

## Requirements

### Requirement: Statuses and transitions [S1]
Statuses: pending_receipt, pending_validation, paid, checked_in, rejected, cancelled. Allowed: pending_receipt->pending_validation; pending_validation->paid|rejected; rejected->pending_validation (re-upload); paid->checked_in; any non-checked_in->cancelled. Other transitions MUST be refused. Legacy RSVP data is discarded.

#### Scenario: Invalid transition
- GIVEN a ticket in pending_receipt
- WHEN approval is attempted
- THEN it is refused and status is unchanged

### Requirement: Initial status [S1]
Price > 0 tickets MUST start as pending_receipt. Price 0 tickets MUST become paid immediately and receive the ticket email.

#### Scenario: Free registration
- GIVEN a price 0 event
- WHEN an attendee registers
- THEN the ticket is paid and the ticket email is sent

### Requirement: Short code [S1]
Each ticket MUST have a unique human-readable code (Crockford alphabet, e.g. EVT-7K3Q).

#### Scenario: Collision
- GIVEN a generated code already exists
- WHEN creating a ticket
- THEN a new code is generated and the ticket is created

### Requirement: Capacity counting [S1]
Only pending_validation, paid, checked_in hold capacity. Cash walk-ins [S2] MUST ignore capacity.

#### Scenario: Walk-in over cap
- GIVEN capacity reached
- WHEN the door registers a cash walk-in
- THEN a paid, checked_in ticket is created
