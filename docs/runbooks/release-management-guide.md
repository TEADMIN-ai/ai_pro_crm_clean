# Release Management Guide

## Release Gates

1. Confirm feature freeze scope.
2. Run full validation suite.
3. Seed QA data in staging only unless production QA is explicitly approved.
4. Complete authenticated acceptance testing for every role.
5. Complete visual accessibility review.
6. Verify backup/recovery procedure.
7. Prepare release notes and rollback notes.
8. Record deployment commit and Vercel deployment URL.

## Required Commands

```powershell
npm run typecheck
npm run lint
npm test
npm run route:integrity
npm run build
npm run sanity
npx --no-install tsx src/lib/entityCheck.ts
```

## Go / No-Go

No-go conditions:

- Critical or High security defect.
- Core role cannot log in.
- Core module cannot load.
- Data loss or cross-tenant/cross-role exposure.
- Visual accessibility blocker on a required workflow.
- Backup or rollback path unknown.

