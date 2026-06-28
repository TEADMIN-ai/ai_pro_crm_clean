# Support & Troubleshooting Guide

## First Checks

- Confirm user role and expected route.
- Confirm deployment URL and commit.
- Check `/api/auth/health` and `/api/health/firebase` status.
- Ask whether the issue affects one role, one module, or all users.
- Capture browser, viewport, timestamp, and screenshot.

## Common Areas

- Auth/role routing: verify Firebase custom claims and `users/{uid}` profile.
- Contractor documents: verify storage path, document subcollection record, and download authorization.
- Vehicle inventory: check connector health, `inventorySyncState`, and latest sync run.
- QS recommendations: verify supplier offers and material pricing exist.
- Hygiene driver jobs: verify assigned user IDs and collection status.

## Escalation

Escalate immediately for suspected data loss, unauthorized access, document exposure, payment/finance data exposure, or production sync failure.

