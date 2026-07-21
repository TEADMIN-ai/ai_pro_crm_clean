# Mackay / FE Miller Workspace Recovery

## Purpose And Scope

This runbook covers one controlled Firestore recovery only: restoring canonical workspace relationships for:

- Mackay and Daughters Enterprises: `contractors/VITBVkrgSdVMRshLn5WEVnmgqFO2`
- F E Miller Pools: `contractors/s2crtIJSqFNe9ipkbgDNJoOvkLY2`

No other contractor, workspace, user, deal, submission, document, activity, or audit record is eligible.

## Evidence

The allowlist is based on repository-local read-only reports:

- `reports/contractors/contractor-cleanup-report.json`
- `output/maintenance/production-data-cleanup-report.json`

Both reports identify the two contractor document IDs above as protected keep-active records. Both show missing contractor `workspaceId` at report time. The canonical contractor workspace fallback comes from `src/lib/workspaces/workspaceMigration.ts` and `scripts/migrations/001_workspace_registry.ts`: contractor users with no stronger workspace signal resolve to the `partner` workspace.

Target workspace:

- Partner Workspace: `0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9006`

## Prerequisites

- Authorized Firebase Admin credentials for the intended project.
- Clean review of the dry-run plan.
- No production write should be attempted without operational approval.
- Confirm `.env.local` or environment variables point at the intended Firebase project.

## Dry Run

```powershell
npx tsx scripts/recoverMackayFeMillerWorkspaces.ts plan
```

Dry-run is read-only. Review:

- `mutationCount`
- each mutation `path`
- `beforeWorkspaceId`
- `afterWorkspaceId`
- `verification.failures`

Expected affected path families are limited to exact allowlisted contractor/user records, their contractor document subcollections, and exact `contractorId == <allowlisted id>` related records in supported relationship collections.

## Verification

```powershell
npx tsx scripts/recoverMackayFeMillerWorkspaces.ts verify
```

Verification checks contractor workspace consistency, user workspace consistency, related record consistency, contractor document attachment, duplicate creation risk, unrelated planned records, Firestore-safe metadata, and expected-state idempotency.

## Apply

Do not run this during this task.

```powershell
$env:TEOS_MIGRATION_CONFIRM="RECOVER_MACKAY_FE_MILLER"
npx tsx scripts/recoverMackayFeMillerWorkspaces.ts plan --apply
```

Apply mode fails closed unless both `--apply` and `TEOS_MIGRATION_CONFIRM=RECOVER_MACKAY_FE_MILLER` are present.

## Backup Location

Apply mode writes a timestamped backup before the first mutation:

```text
output/maintenance/contractor-workspace-recovery/
```

`output/maintenance/` is gitignored. Existing backup files are never overwritten.

## Rollback

Rollback dry-run:

```powershell
npx tsx scripts/recoverMackayFeMillerWorkspaces.ts rollback --backup=output/maintenance/contractor-workspace-recovery/<backup-file>.json
```

Rollback apply, only with operational approval:

```powershell
$env:TEOS_MIGRATION_CONFIRM="RECOVER_MACKAY_FE_MILLER"
npx tsx scripts/recoverMackayFeMillerWorkspaces.ts rollback --backup=output/maintenance/contractor-workspace-recovery/<backup-file>.json --apply
```

Rollback validates backup schema, migration identity, project identity, target workspace, allowlisted contractor IDs, and every recorded document path before restoration.

## Failure Conditions

The tool aborts if:

- either contractor document is missing
- a protected contractor name does not match expected identity evidence
- `users/{contractorId}` points at a different contractor
- any planned path is outside the hard allowlist
- apply confirmation is missing
- backup creation or verification fails
- a document changes between plan and transaction write
- rollback backup is malformed, unrelated, project-mismatched, or partially invalid

## Expected Output

Dry-run should produce JSON with:

- `migrationId`
- `mode`
- target workspace
- target contractor IDs
- deterministic mutation paths and reasons
- verification booleans
- zero backup path

After a successful apply, a second dry-run should show `mutationCount: 0`.

