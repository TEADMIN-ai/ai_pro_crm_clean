# RC1 Security Remediation and Governance Package

Date: 2026-06-29  
Scope: RC1 credential exposure remediation, repository sanitization, Firebase session revocation, and recreated RC1 candidate governance evidence.

## Executive Summary

The final RC1 governance rejection was caused by credential material committed in release/pilot evidence. The confirmed credential material was:

- A Firebase session cookie in `output/pilot/pilot-20260609183717-evidence.json`.
- A Firebase custom token in `tmp/custom-token.txt`.

Both artifacts have been sanitized in the repository tree. The affected Firebase user session was revoked through Firebase Admin for project `torque-empire-ai-pro-crm`. Future temporary evidence paths are now ignored.

## Root Cause

Pilot and temporary validation artifacts were committed before release evidence hygiene rules were in place. Those artifacts captured raw authentication material from operational validation runs.

## Incident Inventory

High-confidence credential scan findings before remediation:

| File | Credential type | Remediation |
| --- | --- | --- |
| `output/pilot/pilot-20260609183717-evidence.json` | Firebase session cookie | Replaced value with `session=<REDACTED>` |
| `tmp/custom-token.txt` | Firebase custom token JWT | Replaced file content with `<REDACTED>` |

Broad keyword scans also found legitimate code/documentation references to tokens, cookies, API key environment variable names, authorization checks, and password handling. These were not credential values.

## Credential Revocation

The exposed Firebase session identified user:

- UID: `z0yX8cyt38hkfa60UEyNTOiX2812`
- Email: `ckaraniete.za@gmail.com`
- Firebase project: `torque-empire-ai-pro-crm`

Firebase Admin revocation was executed with `revokeRefreshTokens(uid)`.

Evidence file:

`output/production-baseline/2026-06-28-reconciliation/credential-revocation-evidence.json`

The revocation evidence records:

- `revoked: true`
- `tokensValidAfterTime: Sun, 28 Jun 2026 22:58:48 GMT`

## Repository Hygiene

`.gitignore` now excludes:

- `tmp/`
- `output/playwright/`
- `output/pilot/`
- `evidence/`

The RC1 production baseline evidence remains committed under `output/production-baseline/` because it contains release-governance artifacts rather than runtime credentials.

## Sanitized Files

- `.gitignore`
- `output/pilot/pilot-20260609183717-evidence.json`
- `tmp/custom-token.txt`
- `docs/release/RC1_Governance_Approval_Package.md`
- `output/production-baseline/2026-06-28-reconciliation/credential-revocation-evidence.json`

## Required Final Checks

Before RC1 is approved, the recreated `rc1-candidate` tag must pass:

1. High-confidence JWT/session/API-key secret scan.
2. Working tree cleanliness check.
3. Tag verification check.
4. Confirmation that no raw Firebase session cookie or custom token remains in the tag tree.

## Final Governance Secret Scan

Result: `PASS`

The recreated `rc1-candidate` tag was scanned for high-confidence credential patterns:

- JWT/session-cookie structure: no matches.
- Raw `session=eyJ...` Firebase session cookies: no matches.
- Raw bearer-token values: no matches.
- Common raw API key and token prefixes: no matches.

Historical inventory identified the original credential introduction points:

- Firebase session cookie: commit `c0eb158` (`Production Pilot Certification - PASS`).
- Firebase custom token: commit `cca74b6` (`Inventory recovery sprint completed`).

The current RC1 candidate tree is sanitized. The exposed Firebase session user has been revoked in Firebase Auth.

## Release Recommendation

RC1 may proceed from the recreated security-clean candidate tag.
