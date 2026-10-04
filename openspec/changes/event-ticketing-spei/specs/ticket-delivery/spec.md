# Ticket Delivery Specification

## Purpose
Emails, ticket page, signed QR, share and PDF.

## Requirements

### Requirement: Emails [S1]
The system MUST send: registration received (with receipt link and SPEI details), rejected (reason + re-upload link), ticket (after approval or free registration). Email failure MUST NOT block registration or approval; `emailSentAt` is recorded and the organizer MAY resend.

#### Scenario: Provider down
- GIVEN the email provider fails
- WHEN an attendee registers
- THEN the ticket is created and emailSentAt stays empty

#### Scenario: No early QR
- GIVEN a pending_validation ticket
- WHEN emails are inspected
- THEN no ticket/QR email was sent

### Requirement: Signed QR [S1]
The QR MUST encode an HMAC-SHA256 signed token compared in constant time. Forged or tampered tokens MUST be rejected.

#### Scenario: Tampered token
- GIVEN a token with a modified payload
- WHEN verified
- THEN it is invalid

### Requirement: Ticket page [S1]
`/ticket/[token]` MUST show only the ticket and QR, with no navigation to dashboard or events. It MUST offer a share-EVENT button (Web Share with copy-link fallback). Non-paid tickets MUST NOT show a QR.

#### Scenario: No navigation
- GIVEN a paid ticket page
- WHEN rendered
- THEN no link to dashboard or event list exists

#### Scenario: Unknown token
- WHEN the token is invalid
- THEN a not-found page is shown

### Requirement: PDF download [S2]
The ticket page SHOULD offer a PDF download using the ticket design.

#### Scenario: Download
- GIVEN a paid ticket
- WHEN PDF is requested
- THEN a PDF with QR and code is returned
