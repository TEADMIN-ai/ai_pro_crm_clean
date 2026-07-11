# Opportunity Management Architecture

**Status:** Architecture foundation
**Revision:** 2026-07-11
**Scope:** RFQ, Tender, RFP, RFI, and Quotation opportunity records

## Purpose
Opportunity Management provides a reusable domain model for every external commercial request. RFQs, Tenders, RFPs, RFIs, and Quotations are normalized into `Opportunity` records without replacing existing contractor workflows.

## Source Of Truth
The canonical runtime shape is `src/types/opportunity.ts`. The reusable helper layer is `src/lib/opportunities`.

Persistent records should use the `opportunities` collection when Opportunity Management becomes an active workflow. Existing `deals`, contractor, tender pack, and contractor document flows remain supported and unchanged until a deliberate migration is approved.

## Core Record
An `Opportunity` contains:

- metadata
- municipality
- closing date
- compulsory briefing
- BOQ requirement
- contractor assignments
- compliance status
- AI analysis
- submission readiness
- messages
- activity timeline

## Collection Boundary
Recommended Firestore layout:

- `opportunities/{opportunityId}`
- `opportunities/{opportunityId}/messages/{messageId}`
- `opportunities/{opportunityId}/activityTimeline/{eventId}`
- `opportunities/{opportunityId}/documents/{documentId}`
- `opportunities/{opportunityId}/analytics/{snapshotId}`

The architecture keeps messages and timeline entries addressable as subcollections while also allowing read-model snapshots on the root opportunity record.

## Compatibility
`opportunityFromTenderData` maps the existing canonical tender contract into the new Opportunity architecture. This is an adapter only. It does not mutate tender, deal, or contractor records.

## AI Rules
AI analysis is advisory. It may store summaries, risks, eligibility requirements, required documents, and recommendations, but it does not determine submission status or override human review.

## Migration Policy
Migration should be additive:

1. Create Opportunity records from new RFQ/Tender/RFP/RFI/Quotation intake.
2. Add read-only adapters for legacy Tender/Deal views.
3. Dual-read where needed.
4. Move workflow ownership only after acceptance testing.
