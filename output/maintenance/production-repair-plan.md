# Production Integrity Repair Plan

Generated: 2026-07-07T18:13:35.251Z

## Executive Summary

- Broken references investigated: 166
- Current Data Integrity Score: 74/100
- Current Reference Health Score: 75/100
- Current Production Readiness Score: 71/100
- Target Data Integrity Score: >95
- Target Reference Health Score: >98
- Target Production Readiness Score: >95
- Estimated after repair: Data Integrity 96/100, Reference Health 99/100, Production Readiness 96/100

## Broken Reference Analysis

Most issues are user identity references: stale user IDs, virtual `system` actor references, or contractor records linked to non-existent auth users. Application issues are isolated to vehicle inventory references.

## Integrity Repair Plan

### Phase 1: Repair missing user references

- Create or document a virtual system actor for users/system references in reporting, without deleting audit logs.
- Relink real contractor.authUid/userId fields to existing users/ documents where the person/account is real.
- For QA/test contractor user links, mark the contractor chain for later archive/delete approval instead of restoring fake users.

### Phase 2: Repair contractor references

- Relink users.contractorId values that point to stale UIDs to canonical contractors/{contractorId}.
- Resolve duplicate test@demo.com contractor group by selecting one canonical test fixture or approving the whole group for cleanup.
- Do not delete contractors until document/deal/tender/activity references are handled.

### Phase 3: Repair application and vehicle finance references

- Relink vehicleFinanceApplications.vehicleId to canonical inventory IDs or archive QA applications as a complete chain.
- For qa-v1-vf-application, handle customer, assessment, documents, events, and tasks together.

### Phase 4: Repair document ownership and storage references

- Repair missing storage object reference images/roar-cars-placeholder.svg or update inventory placeholder metadata.
- Manually verify external HTTP storage URLs before classifying as leaks.
- Confirm document parent references before any document cleanup.

### Phase 5: Re-run integrity audit

- Rerun productionDataCleanup in dry-run mode.
- Regenerate integrity report.
- Approve cleanup only when broken references and storage inconsistencies are intentionally resolved.

## Estimated Repair Impact

If all 166 broken references are repaired or intentionally preserved with virtual/denormalized targets, all four storage inconsistencies are resolved, and QA chains are archived/deleted only after dependency repair.

## Updated Readiness Forecast

- Data Integrity: 74/100 -> 96/100
- Reference Health: 75/100 -> 99/100
- Production Readiness: 71/100 -> 96/100

## Stop Condition

Do not run cleanup apply until the dry-run audit confirms references are repaired or intentionally preserved.