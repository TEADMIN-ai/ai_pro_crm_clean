# Backup & Recovery Guide

## Current Assets

- `scripts/backup.ps1`
- `scripts/Backup-TorqueEmpireCRM.ps1`
- Vercel deployment rollback.
- Firebase project backups/export process must be confirmed with the environment owner.

## RC Requirement

Before v1.0 RC approval, run a non-destructive backup rehearsal or document why it is deferred.

## Recovery Checklist

1. Identify affected deployment commit and timestamp.
2. Promote previous known-good Vercel deployment if application code is the issue.
3. Preserve logs and failed payload examples.
4. Do not run destructive cleanup scripts without explicit approval.
5. For Firestore recovery, use environment-owner-approved export/restore procedure.
6. Re-run validation suite after recovery.

