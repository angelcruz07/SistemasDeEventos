# Receipt Validation Specification

## Purpose
Private receipt upload and organizer approve/reject.

## Requirements

### Requirement: Receipt upload [S1]
Upload MUST be gated by the ticket's unguessable receipt token, rate-limited, and accept only JPEG/PNG/WebP/PDF verified by magic bytes (not just MIME/extension), max 5MB. On success the ticket becomes pending_validation.

#### Scenario: Valid receipt
- GIVEN a pending_receipt ticket and a 2MB PNG
- WHEN uploaded with the valid token
- THEN status is pending_validation

#### Scenario: Spoofed file
- GIVEN an .exe renamed receipt.png
- WHEN uploaded
- THEN it is rejected and status is unchanged

#### Scenario: Oversize
- GIVEN a 6MB file
- WHEN uploaded
- THEN it is rejected

#### Scenario: Bad token
- GIVEN an invalid token
- WHEN uploading
- THEN access is denied

### Requirement: Re-upload after rejection [S1]
A rejected ticket MUST accept a new receipt, moving to pending_validation.

#### Scenario: Re-upload
- GIVEN a rejected ticket
- WHEN a valid receipt is uploaded
- THEN status is pending_validation

### Requirement: Approve / reject [S1]
Only the event owner MAY approve or reject. Rejection MUST include a reason and send a re-upload email. Approval MUST be idempotent and send the ticket email at most once. A rejected ticket MUST NOT hold capacity.

#### Scenario: Double approval
- GIVEN two concurrent approvals of one ticket
- WHEN both run
- THEN exactly one transitions and one ticket email is sent

#### Scenario: Reject without reason
- WHEN rejecting with an empty reason
- THEN it is refused

### Requirement: Receipt privacy and retention [S1]
Receipts MUST be served only to the event owner; never to staff, public, or via public URL. Receipt bytes MUST be purged 30 days after the event date; the ticket keeps receipt metadata/status.

#### Scenario: Non-owner access
- GIVEN a staff session or anonymous request
- WHEN requesting a receipt
- THEN access is denied

#### Scenario: Purge
- GIVEN an event 31 days past
- WHEN the purge runs
- THEN bytes are deleted and ticket status is intact
