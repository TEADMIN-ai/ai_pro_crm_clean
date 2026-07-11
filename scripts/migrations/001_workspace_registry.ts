import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  getWorkspaceById,
  getWorkspaceBySlug,
  getWorkspaceRegistry,
  toWorkspaceRegistrySummary,
} from "@/lib/workspaces/workspaceRegistry";
import { isWorkspaceSummary, type Workspace, type WorkspaceSummary } from "@/lib/workspaces/workspaceTypes";

type MigrationMode = "dry-run" | "apply";

type UserRecord = {
  uid: string;
  data: Record<string, unknown>;
};

type Resolution =
  | {
      status: "resolved";
      workspace: WorkspaceSummary;
      source: string;
      manualReview: false;
    }
  | {
      status: "unresolved";
      reason: string;
      manualReview: true;
    };

type Summary = {
  mode: MigrationMode;
  usersScanned: number;
  usersMigrated: number;
  usersSkipped: number;
  unresolvedUsers: Array<{ uid: string; reason: string }>;
  manualReviewUsers: Array<{ uid: string; reason: string }>;
  errors: Array<{ uid: string; message: string }>;
};

const LEGACY_WORKSPACE_ALIASES: Record<string, string> = {
  torqueempire: "torque-empire",
  "torqueempireptyltd": "torque-empire",
  "torqueempireptyltd.": "torque-empire",
  teos: "torque-empire",
  internalops: "torque-empire",
  roarcars: "roar-cars",
  roarcarssa: "roar-cars",
  "roarcars(sa)": "roar-cars",
  dealer: "roar-cars",
  dealership: "roar-cars",
  vehiclefinance: "roar-cars",
  torqueempirehygiene: "hygiene",
  torqueempirehygienedivision: "hygiene",
  hygieneoperations: "hygiene",
  procurement: "procurement",
  torqueempireprocurement: "procurement",
  clientworkspace: "client",
  client: "client",
  partnerworkspace: "partner",
  partner: "partner",
  internalworkspace: "internal",
  internal: "internal",
  developmentworkspace: "development",
  development: "development",
};

const LEGACY_ROLE_DEFAULTS: Record<string, string> = {
  admin: "torque-empire",
  manager: "torque-empire",
  staff: "torque-empire",
  driver: "hygiene",
  dealerPilot: "roar-cars",
  vehicleFinanceStaff: "roar-cars",
  ROAR_CARS_STAFF: "roar-cars",
};

function parseMode(): MigrationMode {
  if (process.argv.includes("--apply")) return "apply";
  return "dry-run";
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
  return normalized.length ? normalized : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasCanonicalWorkspaceTriple(record: Record<string, unknown>): boolean {
  return Boolean(record.workspace && record.workspaceId && record.workspaceSlug);
}

function findWorkspaceByLabel(value: unknown): { workspace: WorkspaceSummary; source: string } | null {
  const normalized = normalizeLabel(value);
  if (!normalized) return null;

  const aliasSlug = LEGACY_WORKSPACE_ALIASES[normalized];
  if (aliasSlug) {
    const workspace = toWorkspaceRegistrySummary(getWorkspaceBySlug(aliasSlug));
    return workspace ? { workspace, source: `alias:${String(value)}` } : null;
  }

  const registryMatch = getWorkspaceRegistry().find((workspace) => {
    const candidates = [workspace.workspaceId, workspace.slug, workspace.name, workspace.displayName, workspace.type];
    return candidates.some((candidate) => normalizeLabel(candidate) === normalized);
  });

  return registryMatch ? { workspace: toWorkspaceRegistrySummary(registryMatch)!, source: `registry-label:${String(value)}` } : null;
}

function resolveExistingWorkspaceFields(record: Record<string, unknown>): Resolution | null {
  const candidates: Array<{ workspace: WorkspaceSummary; source: string }> = [];

  if (isWorkspaceSummary(record.workspace)) {
    const registryWorkspace = getWorkspaceById(record.workspace.id) ?? getWorkspaceBySlug(record.workspace.slug);
    if (!registryWorkspace) {
      return { status: "unresolved", reason: "existing workspace object is not in Workspace Registry", manualReview: true };
    }
    candidates.push({ workspace: toWorkspaceRegistrySummary(registryWorkspace)!, source: "users.workspace" });
  } else if (record.workspace !== undefined && record.workspace !== null) {
    return { status: "unresolved", reason: "existing workspace field is not canonical", manualReview: true };
  }

  const idWorkspace = getWorkspaceById(record.workspaceId);
  if (idWorkspace) {
    candidates.push({ workspace: toWorkspaceRegistrySummary(idWorkspace)!, source: "users.workspaceId" });
  } else if (record.workspaceId !== undefined && record.workspaceId !== null) {
    return { status: "unresolved", reason: "existing workspaceId is not in Workspace Registry", manualReview: true };
  }

  const slugWorkspace = getWorkspaceBySlug(record.workspaceSlug);
  if (slugWorkspace) {
    candidates.push({ workspace: toWorkspaceRegistrySummary(slugWorkspace)!, source: "users.workspaceSlug" });
  } else if (record.workspaceSlug !== undefined && record.workspaceSlug !== null) {
    return { status: "unresolved", reason: "existing workspaceSlug is not in Workspace Registry", manualReview: true };
  }

  if (!candidates.length) return null;

  const [first] = candidates;
  const hasConflict = candidates.some((candidate) => candidate.workspace.id !== first.workspace.id);
  if (hasConflict) {
    return { status: "unresolved", reason: "existing workspace fields resolve to different registry records", manualReview: true };
  }

  return {
    status: "resolved",
    workspace: first.workspace,
    source: candidates.map((candidate) => candidate.source).join("+"),
    manualReview: false,
  };
}

function resolveWorkspaceFromBusinessData(record: Record<string, unknown>, prefix: string): Resolution | null {
  const fields = [
    "workspaceName",
    "workspaceDisplayName",
    "workspaceType",
    "company",
    "companyName",
    "organisation",
    "organization",
    "businessUnit",
    "division",
    "dealerName",
    "tenant",
    "name",
  ];

  for (const field of fields) {
    const match = findWorkspaceByLabel(record[field]);
    if (match) {
      return { status: "resolved", workspace: match.workspace, source: `${prefix}.${field}.${match.source}`, manualReview: false };
    }
  }

  const email = asString(record.email).toLowerCase();
  if (email.endsWith("@roarcarssa.com")) {
    const workspace = toWorkspaceRegistrySummary(getWorkspaceBySlug("roar-cars"));
    if (workspace) return { status: "resolved", workspace, source: `${prefix}.email-domain`, manualReview: false };
  }

  if (email.endsWith("@torqueempire.net") || email.endsWith("@torqueempire.co.za")) {
    const workspace = toWorkspaceRegistrySummary(getWorkspaceBySlug("torque-empire"));
    if (workspace) return { status: "resolved", workspace, source: `${prefix}.email-domain`, manualReview: false };
  }

  return null;
}

function resolveLegacyRoleDefault(record: Record<string, unknown>): Resolution | null {
  const role = asString(record.role);
  const defaultSlug = LEGACY_ROLE_DEFAULTS[role];
  if (!defaultSlug) return null;

  const workspace = toWorkspaceRegistrySummary(getWorkspaceBySlug(defaultSlug));
  if (!workspace) {
    return { status: "unresolved", reason: `legacy role default '${defaultSlug}' is missing from Workspace Registry`, manualReview: true };
  }

  return { status: "resolved", workspace, source: `legacy-role-default:${role}`, manualReview: false };
}

async function loadContractorRecord(record: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const contractorId = asString(record.contractorId);
  if (!contractorId) return null;

  const snapshot = await getFirebaseAdmin().collection("contractors").doc(contractorId).get();
  if (!snapshot.exists) return null;
  return (snapshot.data() ?? {}) as Record<string, unknown>;
}

async function resolveUserWorkspace(user: UserRecord): Promise<Resolution> {
  const existing = resolveExistingWorkspaceFields(user.data);
  if (existing) return existing;

  const userBusinessMatch = resolveWorkspaceFromBusinessData(user.data, "users");
  if (userBusinessMatch) return userBusinessMatch;

  const contractorRecord = await loadContractorRecord(user.data);
  if (contractorRecord) {
    const contractorExisting = resolveExistingWorkspaceFields(contractorRecord);
    if (contractorExisting?.status === "resolved") {
      return { ...contractorExisting, source: `contractor.${contractorExisting.source}` };
    }
    if (contractorExisting?.status === "unresolved") return contractorExisting;

    const contractorBusinessMatch = resolveWorkspaceFromBusinessData(contractorRecord, "contractor");
    if (contractorBusinessMatch) return contractorBusinessMatch;

    if (asString(user.data.role) === "contractor") {
      const workspace = toWorkspaceRegistrySummary(getWorkspaceBySlug("partner"));
      if (workspace) return { status: "resolved", workspace, source: "contractor.default:partner", manualReview: false };
    }
  }

  const legacyDefault = resolveLegacyRoleDefault(user.data);
  if (legacyDefault) return legacyDefault;

  return { status: "unresolved", reason: "no workspace signal found in user or linked contractor business data", manualReview: true };
}

function buildMigrationPayload(workspace: WorkspaceSummary) {
  return {
    workspace,
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    updatedAt: new Date().toISOString(),
  };
}

async function flushBatch(writes: Array<{ uid: string; payload: ReturnType<typeof buildMigrationPayload> }>) {
  if (!writes.length) return;

  const batch = getFirebaseAdmin().batch();
  for (const write of writes) {
    batch.set(getFirebaseAdmin().collection("users").doc(write.uid), write.payload, { merge: true });
  }
  await batch.commit();
}

async function runMigration(mode: MigrationMode): Promise<Summary> {
  const summary: Summary = {
    mode,
    usersScanned: 0,
    usersMigrated: 0,
    usersSkipped: 0,
    unresolvedUsers: [],
    manualReviewUsers: [],
    errors: [],
  };
  const pendingWrites: Array<{ uid: string; payload: ReturnType<typeof buildMigrationPayload> }> = [];
  const snapshot = await getFirebaseAdmin().collection("users").get();

  for (const document of snapshot.docs) {
    const user: UserRecord = { uid: document.id, data: (document.data() ?? {}) as Record<string, unknown> };
    summary.usersScanned += 1;

    if (hasCanonicalWorkspaceTriple(user.data)) {
      summary.usersSkipped += 1;
      console.log("[workspace-migration:skip]", { uid: user.uid, reason: "canonical workspace fields already present" });
      continue;
    }

    try {
      const resolution = await resolveUserWorkspace(user);
      if (resolution.status === "unresolved") {
        summary.usersSkipped += 1;
        summary.unresolvedUsers.push({ uid: user.uid, reason: resolution.reason });
        summary.manualReviewUsers.push({ uid: user.uid, reason: resolution.reason });
        console.warn("[workspace-migration:manual-review]", { uid: user.uid, reason: resolution.reason });
        continue;
      }

      const payload = buildMigrationPayload(resolution.workspace);
      summary.usersMigrated += 1;
      console.log(mode === "apply" ? "[workspace-migration:migrate]" : "[workspace-migration:dry-run:migrate]", {
        uid: user.uid,
        workspaceId: payload.workspaceId,
        workspaceSlug: payload.workspaceSlug,
        source: resolution.source,
      });

      if (mode === "apply") {
        pendingWrites.push({ uid: user.uid, payload });
        if (pendingWrites.length >= 450) {
          await flushBatch(pendingWrites.splice(0, pendingWrites.length));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push({ uid: user.uid, message });
      summary.manualReviewUsers.push({ uid: user.uid, reason: message });
      console.error("[workspace-migration:error]", { uid: user.uid, message });
    }
  }

  if (mode === "apply") {
    await flushBatch(pendingWrites);
  }

  return summary;
}

async function main() {
  const mode = parseMode();
  console.log("[workspace-migration:start]", {
    migration: "001_workspace_registry",
    mode,
    apply: mode === "apply",
  });
  if (mode !== "apply") {
    console.log("[workspace-migration:dry-run]", "No Firestore writes will be committed. Re-run with --apply to write merge:true updates.");
  }

  const summary = await runMigration(mode);
  console.log("[workspace-migration:summary]", JSON.stringify(summary, null, 2));

  if (summary.errors.length > 0 || summary.unresolvedUsers.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error("[workspace-migration:fatal]", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
