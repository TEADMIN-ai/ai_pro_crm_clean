import { loadEnvConfig } from "@next/env";
import { existsSync, readFileSync } from "node:fs";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  APPLY_CONFIRMATION,
  BACKUP_DIR,
  MIGRATION_ID,
  buildRecoveryPlan,
  runRecovery,
  runRollback,
  validateBackup,
  type RecoveryBackup,
  type RecoveryMode,
} from "@/lib/maintenance/contractorWorkspaceRecovery";

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function parseMode(): RecoveryMode {
  return process.argv.includes("--apply") ? "apply" : "dry-run";
}

function parseCommand(): "plan" | "verify" | "rollback" {
  if (process.argv.includes("rollback")) return "rollback";
  if (process.argv.includes("verify")) return "verify";
  return "plan";
}

function projectId(): string | null {
  return process.env.FIREBASE_PROJECT_ID?.trim()
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
    || null;
}

async function main() {
  loadEnvConfig(process.cwd());

  const command = parseCommand();
  const mode = parseMode();
  const currentProjectId = projectId();
  const db = getFirebaseAdmin();

  console.log("[contractor-workspace-recovery:start]", {
    migrationId: MIGRATION_ID,
    command,
    mode,
    apply: mode === "apply",
    projectId: currentProjectId,
    backupDir: BACKUP_DIR,
    confirmationRequired: mode === "apply" ? `TEOS_MIGRATION_CONFIRM=${APPLY_CONFIRMATION}` : null,
  });

  if (command === "rollback") {
    const backupPath = argValue("--backup");
    if (!backupPath || !existsSync(backupPath)) {
      throw new Error("Rollback requires --backup=<verified backup json>.");
    }
    const backup = JSON.parse(readFileSync(backupPath, "utf8")) as RecoveryBackup;
    validateBackup(backup, currentProjectId);
    const result = await runRollback({ db, backup, mode, projectId: currentProjectId });
    console.log("[contractor-workspace-recovery:rollback]", JSON.stringify({
      mode,
      backupPath,
      mutations: result.mutations.length,
      mutationPaths: result.mutations.map((mutation) => mutation.path),
    }, null, 2));
    return;
  }

  if (command === "verify") {
    const plan = await buildRecoveryPlan(db, mode, currentProjectId);
    console.log("[contractor-workspace-recovery:verify]", JSON.stringify({
      mode,
      targetWorkspace: plan.targetWorkspace,
      mutationCount: plan.mutations.length,
      verification: plan.verification,
    }, null, 2));
    if (plan.verification.failures.length > 0) process.exitCode = 1;
    return;
  }

  const result = await runRecovery({ db, mode, projectId: currentProjectId });
  console.log("[contractor-workspace-recovery:plan]", JSON.stringify({
    mode,
    targetWorkspace: result.plan.targetWorkspace,
    targets: result.plan.targets.map((target) => ({ key: target.key, contractorId: target.contractorId })),
    mutationCount: result.plan.mutations.length,
    mutations: result.plan.mutations.map((mutation) => ({
      path: mutation.path,
      operation: mutation.operation,
      reason: mutation.reason,
      beforeWorkspaceId: mutation.before?.workspaceId ?? null,
      afterWorkspaceId: mutation.after.workspaceId ?? null,
    })),
    verification: result.plan.verification,
    backupPath: result.backupPath,
  }, null, 2));
}

void main().catch((error) => {
  console.error("[contractor-workspace-recovery:fatal]", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

