# Event Media Specification

## Purpose
Multi-image carousel on the public event page.

## Requirements

### Requirement: Multiple images [S2]
An event MAY have multiple ordered images (existing single image migrated as first). The public page MUST show an auto-advancing carousel; a single image MUST render without carousel controls. The public event page MUST NOT link to the dashboard.

#### Scenario: Several images
- GIVEN 3 images
- WHEN the public page loads
- THEN the carousel advances automatically in order

#### Scenario: Zero images
- GIVEN no images
- THEN a placeholder renders without error

#### Scenario: Non-image upload
- WHEN a non-image file is uploaded
- THEN it is rejected
