# Database Architecture

**Document Owner:** Database and Platform Engineering
**Author:** Codex Engineering Office
**Status:** Active Standard
**Version:** 1.0.0
**Revision:** 2026-07-05
**Review Date:** 2026-10-05

## Table of Contents
- [1. Current Firestore Structure](#1-current-firestore-structure)
- [2. Recommended Future Structure](#2-recommended-future-structure)
- [3. Workspace Strategy](#3-workspace-strategy)
- [4. Shared Collections](#4-shared-collections)
- [5. Tenant Isolation](#5-tenant-isolation)
- [6. Document Storage](#6-document-storage)
- [7. Indexes](#7-indexes)
- [8. Naming Standards](#8-naming-standards)
- [9. Migration Strategy](#9-migration-strategy)

## Revision History
| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-07-05 | Codex Engineering Office | Initial database architecture |

## 1. Current Firestore Structure
The current platform uses Firestore for user profiles, applications, workflow state, notifications, tasks, timelines, and supporting operational records. Existing collections must remain supported until an approved migration is complete.

## 2. Recommended Future Structure
Future schema should separate:
- identity/profile records
- workspace metadata
- application master records
- workflow/task/timeline events
- notifications
- audit records
- document metadata

## 3. Workspace Strategy
Every record that belongs to an operational context should carry workspace identifiers. Shared platform records must be clearly marked as platform-level rather than workspace-level.

## 4. Shared Collections
Shared collections are acceptable for identities, configuration, or global lookup data if access policy is explicit and document shape is stable.

## 5. Tenant Isolation
Tenant isolation is enforced through document structure, query constraints, and server-side authorization. Client-side filtering alone is not sufficient.

## 6. Document Storage
Document binaries should be stored separately from metadata. Metadata records should reference storage paths, ownership, classification, verification status, and retention policy.

## 7. Indexes
Indexes should be documented with the query they support. Any index added to satisfy a dashboard or search path must be traceable to a named operational use case.

## 8. Naming Standards
Use predictable, plural collection names, stable field names, and domain-centric record identifiers. Avoid ambiguous abbreviations in persistent schema.

## 9. Migration Strategy
Schema migrations should be additive first, then dual-read if required, then dual-write only where necessary, and finally cleanup after verification.

## Cross References
- [TEOS_MASTER_ENGINEERING_CHARTER](./TEOS_MASTER_ENGINEERING_CHARTER.md)
- [SYSTEM_ARCHITECTURE](./SYSTEM_ARCHITECTURE.md)
