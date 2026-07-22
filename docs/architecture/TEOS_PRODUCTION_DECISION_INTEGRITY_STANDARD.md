# TEOS Production Decision Integrity Standard

**Document Owner:** Engineering Leadership, Torque Empire (Pty) Ltd
**Author:** Codex Engineering Office
**Status:** Active Governance Standard
**Version:** 1.0.0
**Revision:** 2026-07-21
**Review Date:** 2026-10-21

## 1. Purpose and Scope
TEOS is an operating control platform. This standard governs all consequential production workflows, corrective work, future features, services, APIs, automation, AI-assisted decisions, migrations, reporting, and UI projections. Business truth comes before interface convenience.

## 2. Consequential Decision Classification
A decision is consequential when it affects access, authority, workspace ownership, contractor identity, compliance, readiness, recommendation, assignment, submission, money, reporting, governance, or audit posture. Consequential decisions must expose explicit statuses such as ALLOWED, BLOCKED, UNKNOWN, UNRESOLVED, INCOMPLETE, DATA_ERROR, or STALE.

## 3. Canonical Identity Rules
Authentication, profile hydration, role resolution, contractor identity, and workspace context are separate facts. Do not confuse userId, authUid, uid, contractorId, profile IDs, or display names. Missing, ambiguous, archived, duplicate, cross-workspace, or unresolved contractor identity must block positive decisions.

## 4. Workspace Integrity Rules
Workspace is a business boundary. Decisions must identify active workspace and evidence workspace. Missing workspace context is not a valid default. Cross-workspace evidence is rejected unless explicitly authorized and audited.

## 5. Evidence Classification
Evidence must be classified as valid, missing, expired, unverified, unclassified, malformed, conflicting, stale, inaccessible, wrong-entity, duplicate, not applicable, or requiring manual review. Absence of evidence is never evidence of compliance, completeness, readiness, eligibility, suitability, authorization, or success.

## 6. Fail-Closed Requirements
Consequential decisions must fail closed. Unknown, missing, stale, conflicting, malformed, inaccessible, or unverifiable data remains explicit and blocking unless a documented exception authorizes otherwise.

## 7. Mandatory Gate Rules
Mandatory gates override numeric scores. Identity failure, workspace failure, authority failure, compliance failure, mandatory requirement failure, stale evidence, or unverifiable evidence blocks approval, readiness, assignment, submission, and positive recommendations.

## 8. Numeric Scoring Rules
Scores may describe suitability or progress but may not overrule gates. Scores must carry blockers, evidence references, evaluatedAt, sourceVersion where available, logicVersion, and stale status when used as authority. Empty requirement sets may not produce 100% readiness without reviewed source evidence that no mandatory requirements apply.

## 9. State-Machine Design Rules
Every state machine must define valid states, allowed transitions, transition authority, required evidence, blocking conditions, failure handling, and audit event. Unsupported states must not fall into valid defaults.

## 10. Server-Side Authority Rules
Every consequential action must be authorized server-side. API handlers must validate identity, role, workspace, request shape, state transition, mandatory gates, and audit impact before source-of-truth writes.

## 11. UI Responsibility Boundaries
UI controls may reflect canonical decisions but must not become authority. The UI must not invent readiness, mask unresolved data with zero counts, convert unknown to success, enable actions without server revalidation, or hide defects through presentation-only changes.

## 12. AI Governance Rules
AI may assist extraction, triage, interpretation, and recommendation. AI may not invent evidence, approve missing information, ignore confidence or extraction failure, overwrite authoritative workflow state, or become the sole authority for compliance or assignment.

## 13. Data Freshness and Versioning
Derived decisions must include freshness and logic version information where persisted or exposed as authority. Existing precomputed outcomes must not be trusted when source evidence, identity linkage, workspace context, or logic version is stale or unknown.

## 14. Error and Unresolved-State Handling
Exceptions, partial failures, inaccessible records, malformed payloads, and unsupported states must produce explicit blocking or error states. Swallowed exceptions, optimistic transitions before persistence, and generic success after partial consequential failure are prohibited.

## 15. Auditability Requirements
Every consequential conclusion must be traceable to evaluated evidence and entity references. Every consequential action must create or preserve audit evidence containing actor, authority, entity IDs, source evidence, decision status, blockers, timestamps, and logic version where applicable.

## 16. Migration and Recalculation Safeguards
Any migration, recomputation, backfill, cleanup, or production repair must be allowlisted, backed up, dry-run first, idempotent, auditable, reversible where feasible, production-confirmed, and independently verified.

## 17. Testing Standards
Tests must prove business invariants and negative paths: valid evidence, missing evidence, unresolved evidence, stale evidence, conflicting evidence, malformed evidence, unauthorized actor, invalid transition, persistence failure, manipulated client request, duplicate operation, retry/idempotency, audit creation, and historical logic-version mismatch where applicable. Passing tests are insufficient if they encode invalid business rules.

## 18. Definition of Done
A consequential workflow change is done only when business outcome, canonical entities, source of truth, mandatory gates, failure behavior, server authority, audit behavior, and testable invariants are documented and verified.

## 19. Code-Review Checklist
Review business conclusion, canonical entity IDs, source records, mandatory gates, fail-closed behavior, server authority, UI boundaries, AI advisory limits, audit evidence, and tests proving false-positive prevention.

## 20. Production Release Gate
Before release, confirm versioning, stale-record handling, controlled migrations, intentional production writes, known rollback or repair paths, and operational observability. Do not deploy decisions that can create unsupported business conclusions.

## 21. Prohibited Patterns
Prohibited in consequential logic: fallback 100 scores, empty mandatory requirements treated as complete, zero missing counts before evaluation, undefined booleans treated as true, generic positive recommendations with blockers, client-only eligibility, UI actions without API revalidation, identity confusion, default workspace assignment, stale score reuse, success after partial failure, swallowed exceptions, unsupported states falling to valid defaults, and AI output treated as authoritative evidence.

## 22. Compliant Patterns
Use bounded domain decision services returning status, allowed, score, blockingReasons, warnings, evidence, entity references, evaluatedAt, sourceVersion, logicVersion, and stale. Services should cover identity resolution, workspace authorization, compliance decision, tender eligibility, contractor opportunity matching, assignment authorization, submission readiness, and invoice payment status, composed through clear contracts.

## Business Invariant Format
Use GIVEN, WHEN, THEN, AND, NEVER. Example: GIVEN a contractor with unresolved identity, WHEN recommendation or assignment is evaluated, THEN the result must be BLOCKED, AND the blocking reason must be recorded, NEVER may the contractor be reported as READY or assignable.

## Cross References
- [TEOS_MASTER_ENGINEERING_CHARTER](./TEOS_MASTER_ENGINEERING_CHARTER.md)
- [SYSTEM_ARCHITECTURE](./SYSTEM_ARCHITECTURE.md)
- [API_ARCHITECTURE](./API_ARCHITECTURE.md)
- [AI_ARCHITECTURE](./AI_ARCHITECTURE.md)
