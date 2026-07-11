# Authentication Architecture

**Document Owner:** Security and Platform Engineering
**Author:** Codex Engineering Office
**Status:** Active Standard
**Version:** 1.0.0
**Revision:** 2026-07-05
**Review Date:** 2026-10-05

## Table of Contents
- [1. Current Authentication](#1-current-authentication)
- [2. Future Workspace Resolution](#2-future-workspace-resolution)
- [3. Role Resolution](#3-role-resolution)
- [4. Portal Resolution](#4-portal-resolution)
- [5. Permission Resolution](#5-permission-resolution)
- [6. Session Lifecycle](#6-session-lifecycle)
- [7. Token Lifecycle](#7-token-lifecycle)
- [8. Future SSO Readiness](#8-future-sso-readiness)

## Revision History
| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-07-05 | Codex Engineering Office | Initial authentication architecture |

## 1. Current Authentication
Current authentication must be treated as identity proof plus profile hydration. Firebase Authentication establishes the user identity. Firestore or equivalent profile data provides the operational role, company, status, and workspace context.

## 2. Future Workspace Resolution
Workspace resolution should occur after authentication and before portal rendering. The resolved workspace determines data scope, dashboard composition, and the set of allowed actions.

## 3. Role Resolution
Role resolution is not a display concern. It is a controlled decision derived from profile records, custom claims, and application policy. Fallback behavior must be explicit and auditable.

## 4. Portal Resolution
Portal resolution maps the authenticated user to the correct operational surface. Examples include admin, manager, consultant, auditor, or guest. Guest is only valid when the user truly has no assigned operational role.

## 5. Permission Resolution
Permissions are derived from role, workspace membership, and policy. They should be evaluated server-side and mirrored client-side only for presentation.

## 6. Session Lifecycle
Sessions must support login, refresh, profile hydration, revalidation, logout, and expiration. The UI must not infer final identity state before profile hydration completes.

## 7. Token Lifecycle
Token refresh should update claims and user state without forcing the user into an incorrect placeholder role. Claims are input into resolution, not the only source of truth.

## 8. Future SSO Readiness
Authentication boundaries should remain compatible with future single sign-on providers by keeping identity, profile, role, and workspace resolution distinct.

## Cross References
- [TEOS_MASTER_ENGINEERING_CHARTER](./TEOS_MASTER_ENGINEERING_CHARTER.md)
- [MULTI_WORKSPACE_ARCHITECTURE](./MULTI_WORKSPACE_ARCHITECTURE.md)
