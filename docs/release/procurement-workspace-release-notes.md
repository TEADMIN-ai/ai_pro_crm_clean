# Procurement Workspace Release Documentation

**Release scope:** Opportunity Intake Wizard, Opportunity Workspace, Tender Pack Builder, Submission Review Workspace, Contractor Delivery Workspace  
**Date:** 2026-07-13

## Summary

This release documents the completed Procurement Workspace implementation as a presentation-first set of enterprise workspaces. The implementation is structured around reusable mock-data services and shared UI components, with no backend mutations added for the new screens.

## Features

### Opportunity Intake Wizard
- Guided intake flow for new opportunities.
- Multi-step entry for opportunity details and document upload.
- Presentation-only step state and summary surfaces.
- No business logic changes to record creation or upload handling.

### Opportunity Workspace
- Opportunity presented as a project-scoped workspace.
- Tabs for Overview, Contractors, Documents, Forms, BOQ, Tasks, Messages, Timeline, Submission, and Audit.
- Contractor tab supports Recommended Contractors, Assign, Remove, Readiness, AI Match, and Compliance in mock form.
- Shared enterprise tables, panels, cards, and tabs used for the workspace shell.

### Tender Pack Builder
- Required Documents list.
- Generated PDFs list.
- Missing Documents list.
- Submission Profile panel.
- Pack Progress summary.
- Actions surface for Generate Pack, Preview, Download, and Email Contractor.
- Email action is present only as a disabled presentation control.

### Submission Review Workspace
- Submission Readiness summary.
- Required Documents and Missing Documents panels.
- Validation checks.
- Signatures review.
- BOQ and Pricing summary.
- Approval Timeline and Approvers panels.
- Status and presentation-only approval actions.

### Contractor Delivery Workspace
- Presentation shell for the post-approval delivery stage.
- Tender pack readiness, submission profile, pack contents, deadline control, and action rail.
- Disabled delivery actions for download and email.
- Explicitly marked as presentation only and not wired to email delivery.

## User Workflow

1. A user enters an opportunity through the intake wizard and stages the opportunity record.
2. The opportunity is reviewed in the project-style Opportunity Workspace.
3. The Tender Pack Builder assembles mock pack contents, generated PDFs, and missing document gaps.
4. The Submission Review Workspace surfaces readiness, validation, signatures, BOQ, pricing, and approver state.
5. The Contractor Delivery Workspace presents the post-approval delivery shell for contractor handoff.

The flow is intentionally linear, but the underlying implementation remains read-only presentation state rather than a live workflow engine.

## Architecture Summary

- The new workspaces follow the TEOS workspace principle: each operational area is isolated as its own view and composed from shared enterprise primitives.
- Domain logic is kept out of presentation components.
- Reusable services provide mock workspace state for the UI surfaces.
- No new backend contracts were introduced.
- No mutations, approvals, email sends, or record creation paths were added for these screens.

## Screens Affected

- `/dashboard/opportunity-register/new`
- `/dashboard/opportunity-register/upload`
- `/dashboard/opportunity-centre`
- `/dashboard/tender-pack-requests`
- `/dashboard/submission-review`
- `/dashboard/contractor`

## APIs Used

No new APIs were added for this release documentation scope.

The new and updated screens are presentation-only and do not invoke backend mutations. They sit alongside existing platform routes and services, but the work documented here does not depend on new API behavior.

## Components Added

- `src/components/opportunity-register/OpportunityIntakeWizard.tsx`
- `src/components/opportunity-centre/OpportunityProjectWorkspace.tsx`
- `src/components/tender/TenderPackBuilderWorkspace.tsx`
- `src/components/submission-review/SubmissionReviewWorkspace.tsx`
- `src/components/contractors/ContractorDeliveryWorkspace.tsx`
- Shared supporting UI and state modules under:
  - `src/lib/opportunities/*`
  - `src/lib/tender/tenderPackBuilder.ts`
  - `src/lib/submission-review.ts`

## Validation Completed

- `npm run typecheck` passed.
- `npm run build` passed.

Validation was completed without deployment, without commit, and without push.

## Notes

- All documented screens are presentation-only.
- No backend mutation logic was introduced for the new procurement workspace surfaces.
- No API changes were required for this release note.
