import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { buildUserProfile, type UserProfile } from "@/lib/auth/userProfile";
import { getWorkspaceBySlug, listWorkspaces, toWorkspaceRegistrySummary } from "./workspaceRegistry";
import type { WorkspaceSummary } from "./workspaceTypes";

export interface WorkspaceMigrationSource {
  uid: string;
  profile: UserProfile | null;
  profileData?: Record<string, unknown>;
}

export interface WorkspaceMigrationResult {
  migrated: boolean;
  workspace: WorkspaceSummary | null;
  source: string | null;
  persisted: boolean;
}

const LEGACY_WORKSPACE_ALIASES: Record<string, string> = {
  torqueempire: "torque-empire",
  "torqueempireptyltd": "torque-empire",
  "torqueempireptyltd.": "torque-empire",
  roarcars: "roar-cars",
  roarcarssa: "roar-cars",
  "roarcars(sa)": "roar-cars",
  "torqueempirehygiene": "hygiene",
  "torqueempirehygienedivision": "hygiene",
  procurement: "procurement",
  "torqueempireprocurement": "procurement",
  "clientworkspace": "client",
  client: "client",
  "partnerworkspace": "partner",
  partner: "partner",
  "internalworkspace": "internal",
  internal: "internal",
  "developmentworkspace": "development",
  development: "development",
};

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");

  return normalized.length > 0 ? normalized : null;
}

function findWorkspaceByLabel(value: unknown): WorkspaceSummary | null {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return null;
  }

  const aliasSlug = LEGACY_WORKSPACE_ALIASES[normalized];
  if (aliasSlug) {
    const aliasedWorkspace = getWorkspaceBySlug(aliasSlug);
    if (aliasedWorkspace) {
      return toWorkspaceRegistrySummary(aliasedWorkspace);
    }
  }

  const registryMatch = listWorkspaces().find((workspace) => {
    const candidates = [workspace.id, workspace.slug, workspace.displayName, workspace.type];
    return candidates.some((candidate) => normalizeLabel(candidate) === normalized);
  });

  return registryMatch ?? null;
}

function resolveWorkspaceFromRecord(record: Partial<UserProfile> | Record<string, unknown> | null | undefined): {
  workspace: WorkspaceSummary | null;
  source: string | null;
} {
  if (!record) {
    return { workspace: null, source: null };
  }

  const data = record as Record<string, unknown> & Partial<UserProfile>;

  if (data.workspace && typeof data.workspace === "object") {
    const workspace = buildUserProfile({ workspace: data.workspace }).workspace;
    if (workspace) {
      return { workspace, source: "workspace" };
    }
  }

  const idWorkspace = findWorkspaceByLabel(data.workspaceId);
  if (idWorkspace) {
    return { workspace: idWorkspace, source: "workspaceId" };
  }

  const slugWorkspace = findWorkspaceByLabel(data.workspaceSlug);
  if (slugWorkspace) {
    return { workspace: slugWorkspace, source: "workspaceSlug" };
  }

  const companyWorkspace = findWorkspaceByLabel(data.company ?? data.companyName ?? data.name);
  if (companyWorkspace) {
    return { workspace: companyWorkspace, source: "company" };
  }

  return { workspace: null, source: null };
}

async function loadContractorRecord(contractorId: string | undefined): Promise<Record<string, unknown> | null> {
  if (!contractorId) {
    return null;
  }

  const snapshot = await getFirebaseAdmin().collection("contractors").doc(contractorId).get();
  if (!snapshot.exists) {
    return null;
  }

  return (snapshot.data() ?? {}) as Record<string, unknown>;
}

export function needsWorkspaceMigration(profileData: Record<string, unknown> | UserProfile | null | undefined): boolean {
  if (!profileData || typeof profileData !== "object") {
    return true;
  }

  const record = profileData as Record<string, unknown>;
  return !(record.workspace && record.workspaceId && record.workspaceSlug);
}

export async function resolveLegacyWorkspace(input: WorkspaceMigrationSource): Promise<{
  workspace: WorkspaceSummary | null;
  source: string | null;
}> {
  const profileWorkspace = resolveWorkspaceFromRecord(input.profileData ?? input.profile ?? null);
  if (profileWorkspace.workspace) {
    return profileWorkspace;
  }

  const contractorId = input.profile?.contractorId ?? (typeof input.profileData?.contractorId === "string" ? input.profileData.contractorId : undefined);
  const contractorData = await loadContractorRecord(contractorId);
  const contractorWorkspace = resolveWorkspaceFromRecord(contractorData);
  if (contractorWorkspace.workspace) {
    return {
      workspace: contractorWorkspace.workspace,
      source: contractorWorkspace.source ? `contractor.${contractorWorkspace.source}` : "contractor",
    };
  }

  if (contractorData) {
    const fallbackWorkspace = getWorkspaceBySlug("partner");
    if (fallbackWorkspace) {
      return {
        workspace: toWorkspaceRegistrySummary(fallbackWorkspace),
        source: "contractor.default",
      };
    }
  }

  return { workspace: null, source: null };
}

export async function migrateLegacyWorkspace(input: WorkspaceMigrationSource & { persist?: boolean }): Promise<WorkspaceMigrationResult> {
  if (!needsWorkspaceMigration(input.profileData ?? input.profile ?? null)) {
    return {
      migrated: false,
      workspace: input.profile?.workspace ?? null,
      source: null,
      persisted: false,
    };
  }

  const resolved = await resolveLegacyWorkspace(input);
  if (!resolved.workspace) {
    return {
      migrated: false,
      workspace: null,
      source: null,
      persisted: false,
    };
  }

  const persisted = input.persist !== false;
  if (persisted) {
    await getFirebaseAdmin().collection("users").doc(input.uid).set(
      {
        workspace: resolved.workspace,
        workspaceId: resolved.workspace.id,
        workspaceSlug: resolved.workspace.slug,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  return {
    migrated: true,
    workspace: resolved.workspace,
    source: resolved.source,
    persisted,
  };
}

