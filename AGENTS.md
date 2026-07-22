# Repository Coding-Agent Instructions

Before modifying production business logic, Codex and any coding agent must read:
- `docs/architecture/TEOS_MASTER_ENGINEERING_CHARTER.md`
- `docs/architecture/TEOS_PRODUCTION_DECISION_INTEGRITY_STANDARD.md`

Before coding, state the business outcome, canonical entities, source of truth, mandatory gates, failure behaviour, server-side authority, audit requirements, and testable business invariants.

After implementation, report business rules implemented, failure paths, authorization enforcement, audit events, tests proving outcomes, unresolved risks, and migration or recomputation impact.

Do not weaken existing architecture, security, testing, workspace, API, AI, or deployment standards. Consequential business decisions must fail closed and must be enforced server-side.
