# Door Check-in Specification

## Purpose
Staff access by link + PIN, scan/search, atomic check-in, cash walk-ins.

## Requirements

### Requirement: Door access [S2]
The organizer MUST be able to generate a per-event door link + PIN (stored hashed), and revoke or regenerate it. Staff MUST enter a name on open, stored as `checkedInBy`.

#### Scenario: Wrong PIN
- WHEN a wrong PIN is submitted
- THEN access is denied

#### Scenario: Regenerated link
- GIVEN the link was regenerated
- WHEN the old link/PIN is used
- THEN access is denied

### Requirement: Staff restrictions [S2]
Staff MUST NOT access receipts, revenue, cash-up, or event settings. Staff MAY scan, search by name/code, check in, and register walk-ins.

#### Scenario: Staff requests receipt
- GIVEN a valid door session
- WHEN requesting a receipt or revenue data
- THEN access is denied

### Requirement: Scan and search [S2]
The scanner MUST verify the QR signature and show attendee info, answers and payment status. Manual search by name/code MUST be available.

#### Scenario: Forged QR
- WHEN a QR with invalid signature is scanned
- THEN it is rejected and nothing is checked in

#### Scenario: Other event's QR
- WHEN a valid QR for a different event is scanned
- THEN it is rejected

#### Scenario: Unpaid ticket
- GIVEN a pending_validation ticket found by search
- THEN check-in is refused

### Requirement: Atomic single-use check-in [S2]
Check-in MUST succeed only from paid. A second scan MUST show "already checked in at HH:MM" (America/Mexico_City) with who checked in.

#### Scenario: Double scan
- GIVEN a checked_in ticket
- WHEN scanned again
- THEN already-checked-in message with time is shown

#### Scenario: Concurrent check-in
- GIVEN two staff check in the same paid ticket simultaneously
- THEN exactly one succeeds

### Requirement: Cash walk-in [S2]
Staff MUST be able to register a walk-in creating a ticket paid + checked_in, method cash, at the event price, ignoring capacity, only if cash is enabled.

#### Scenario: Cash disabled
- GIVEN allowCash is false
- WHEN registering a walk-in
- THEN it is refused
