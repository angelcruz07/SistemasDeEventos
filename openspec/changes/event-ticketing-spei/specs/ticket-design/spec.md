# Ticket Design Specification

## Purpose
Organizer-only visual customization of tickets.

## Requirements

### Requirement: Design editor [S1 fixed default, S2 editor]
Slice 1 MUST ship one fixed design. Slice 2 MUST let the organizer pick a template, background/text/accent colors, logo and header image, with live preview. Attendees and staff MUST NOT change design.

#### Scenario: Apply design
- GIVEN the organizer sets accent color #ff0000
- WHEN a ticket page or PDF renders
- THEN it uses that color

#### Scenario: Invalid color
- WHEN a non-hex color is saved
- THEN it is rejected

#### Scenario: No design set
- GIVEN no custom design
- THEN the default design renders

#### Scenario: Non-owner edit
- WHEN a non-owner saves a design
- THEN it is denied
