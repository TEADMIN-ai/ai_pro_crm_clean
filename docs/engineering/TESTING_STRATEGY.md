# Testing Strategy

**Document Owner:** QA and Engineering Quality
**Author:** Codex Engineering Office
**Status:** Active Standard
**Version:** 1.0.0
**Revision:** 2026-07-05
**Review Date:** 2026-10-05

## Table of Contents
- [1. Testing Goals](#1-testing-goals)
- [2. Test Layers](#2-test-layers)
- [3. Coverage Expectations](#3-coverage-expectations)
- [4. Release Gates](#4-release-gates)
- [5. Manual Verification](#5-manual-verification)

## Revision History
| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-07-05 | Codex Engineering Office | Initial testing strategy |

## 1. Testing Goals
Testing must prove behavior, protect backward compatibility, and catch workflow regressions before production.

## 2. Test Layers
- Unit tests for business rules.
- Integration tests for API and data flow.
- Regression tests for previously fixed defects.
- End-to-end checks for critical user journeys.

## 3. Coverage Expectations
Critical paths include authentication, workspace hydration, application submission, workflow transition, task generation, notification creation, and document handling.

## 4. Release Gates
At minimum, relevant lint, typecheck, build, and targeted tests must pass before release.

## 5. Manual Verification
Manual verification must cover live operational flows where business risk is high or browser behavior matters.

## Cross References
- [TEOS_MASTER_ENGINEERING_CHARTER](../architecture/TEOS_MASTER_ENGINEERING_CHARTER.md)
