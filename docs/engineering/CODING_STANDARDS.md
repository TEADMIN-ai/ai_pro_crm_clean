# Coding Standards

**Document Owner:** Engineering Standards
**Author:** Codex Engineering Office
**Status:** Active Standard
**Version:** 1.0.0
**Revision:** 2026-07-05
**Review Date:** 2026-10-05

## Table of Contents
- [1. Folder Standards](#1-folder-standards)
- [2. Naming Standards](#2-naming-standards)
- [3. React Standards](#3-react-standards)
- [4. Next.js Standards](#4-nextjs-standards)
- [5. Firestore Standards](#5-firestore-standards)
- [6. API Standards](#6-api-standards)
- [7. Testing Standards](#7-testing-standards)
- [8. Documentation Standards](#8-documentation-standards)

## Revision History
| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-07-05 | Codex Engineering Office | Initial coding standards |

## 1. Folder Standards
- Group code by domain and responsibility.
- Keep shared utilities explicit and limited.
- Avoid dumping unrelated logic into generic folders.

## 2. Naming Standards
- Use descriptive nouns for files and components.
- Use verb-based names for actions and mutations.
- Avoid abbreviations unless they are domain standard.

## 3. React Standards
- Keep components focused.
- Extract reusable state and presentation boundaries.
- Avoid business logic in view rendering where a service or hook is clearer.

## 4. Next.js Standards
- Use app-router conventions consistently.
- Keep server and client responsibilities explicit.
- Route handlers should validate, authorize, delegate, and return.

## 5. Firestore Standards
- Use stable collection names and typed fields.
- Record timestamps consistently.
- Favor immutable event records for audit and timeline data.

## 6. API Standards
- Return structured errors.
- Keep route contracts documented.
- Do not leak internal implementation details in responses.

## 7. Testing Standards
- Unit tests for logic.
- Integration tests for workflow and persistence boundaries.
- Regression tests for previously broken behavior.

## 8. Documentation Standards
- Document ownership, revision, and review date.
- Reference related architecture docs.
- Update docs when behavior changes materially.

## Cross References
- [TEOS_MASTER_ENGINEERING_CHARTER](../architecture/TEOS_MASTER_ENGINEERING_CHARTER.md)
