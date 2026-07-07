import type { BrokenReferenceIssue, RepairOperation } from "./repairStrategies";
import { isArchivalCandidate, nowIso } from "./repairStrategies";
import type { FirestoreDb } from "./referenceValidator";

type DocumentData = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function copyWorkspaceFields(data: DocumentData): DocumentData {
  const workspace: DocumentData = {};
  for (const field of ["workspace", "workspaceId", "workspaceSlug"]) {
    const value = asString(data[field]);
    if (value) workspace[field] = value;
  }
  return workspace;
}

async function getData(db: FirestoreDb, path: string): Promise<DocumentData | null> {
  const snapshot = await db.doc(path).get();
  return snapshot.exists ? ((snapshot.data() ?? {}) as DocumentData) : null;
}

async function uniqueByField(
  db: FirestoreDb,
  collection: string,
  field: string,
  value: string | undefined,
): Promise<string[]> {
  if (!value) return [];
  const snapshot = await db.collection(collection).where(field, "==", value).limit(3).get();
  return snapshot.docs.map((doc) => doc.id);
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function restoredUserPayload(uid: string, sourcePath: string, sourceData: DocumentData | null, issue: BrokenReferenceIssue): DocumentData {
  const archival = isArchivalCandidate(issue) || issue.collection === "auditLogs";
  const sourceId = issue.documentId;
  const email = asString(sourceData?.email) ?? asString(sourceData?.contactEmail);
  const name =
    asString(sourceData?.name) ??
    asString(sourceData?.displayName) ??
    asString(sourceData?.companyName) ??
    asString(sourceData?.contactPerson) ??
    (uid === "system" ? "System Actor" : `Restored Identity ${uid}`);

  return {
    uid,
    email: email ?? null,
    name,
    role: issue.collection === "contractors" ? "contractor" : "viewer",
    contractorId: issue.collection === "contractors" ? sourceId : null,
    status: uid === "system" ? "system" : archival ? "archived" : "restored",
    archived: uid !== "system" && archival,
    disabled: uid !== "system" && archival,
    system: uid === "system",
    integrityRestored: true,
    integrityRestoredAt: nowIso(),
    integrityRepairSource: sourcePath,
    createdAt: Date.now(),
    updatedAt: nowIso(),
    ...copyWorkspaceFields(sourceData ?? {}),
  };
}

function restoredContractorPayload(contractorId: string, sourcePath: string, sourceData: DocumentData | null): DocumentData {
  const email = asString(sourceData?.email);
  const name =
    asString(sourceData?.name) ??
    asString(sourceData?.displayName) ??
    ([sourceData?.firstName, sourceData?.lastName].map(asString).filter(Boolean).join(" ") ||
      email ||
      contractorId);

  return {
    id: contractorId,
    contractorId,
    uid: contractorId,
    authUid: contractorId,
    userId: contractorId,
    email: email ?? null,
    contactEmail: email ?? null,
    name,
    companyName: name,
    contactPerson: name,
    status: asString(sourceData?.status) ?? "restored",
    complianceApproved: false,
    integrityRestored: true,
    integrityRestoredAt: nowIso(),
    integrityRepairSource: sourcePath,
    createdAt: Date.now(),
    updatedAt: nowIso(),
    ...copyWorkspaceFields(sourceData ?? {}),
  };
}

function restoredInventoryPayload(vehicleId: string, sourcePath: string, sourceData: DocumentData | null): DocumentData {
  const title = asString(sourceData?.vehicleTitle) ?? vehicleId;
  const [vehicleMake = "Unknown", ...modelParts] = title.split(/\s+/);

  return {
    vehicleId,
    sourceVehicleId: vehicleId,
    stockNumber: asString(sourceData?.vehicleInventoryId) ?? vehicleId,
    vehicleMake,
    vehicleModel: modelParts.join(" ") || title,
    vehicleVariant: title,
    vehiclePrice: typeof sourceData?.vehiclePrice === "number" ? sourceData.vehiclePrice : Number(sourceData?.dealValue ?? 0),
    yearModel: typeof sourceData?.vehicleYear === "number" ? sourceData.vehicleYear : 0,
    mileage: typeof sourceData?.vehicleMileage === "number" ? sourceData.vehicleMileage : 0,
    status: "PENDING",
    archived: true,
    integrityRestored: true,
    integrityRestoredAt: nowIso(),
    integrityRepairSource: sourcePath,
    updatedAt: nowIso(),
  };
}

async function resolveUserContractor(db: FirestoreDb, issue: BrokenReferenceIssue, sourceData: DocumentData | null): Promise<RepairOperation> {
  const email = asString(sourceData?.email);
  const candidates = unique([
    ...(await uniqueByField(db, "contractors", "authUid", issue.documentId)),
    ...(await uniqueByField(db, "contractors", "userId", issue.documentId)),
    ...(await uniqueByField(db, "contractors", "email", email)),
    ...(await uniqueByField(db, "contractors", "contactEmail", email)),
  ]);

  if (candidates.length === 1) {
    return {
      issueId: issue.issueId,
      type: "relink-source",
      severity: issue.severity,
      sourcePath: issue.sourcePath,
      referenceField: issue.referenceField,
      targetPath: `contractors/${candidates[0]}`,
      updatePath: issue.sourcePath,
      updateData: {
        contractorId: candidates[0],
        updatedAt: nowIso(),
        integrityRepairedAt: nowIso(),
        integrityRepairStrategy: "RELINK",
      },
      reason: "Resolved a single canonical contractor from authUid/userId/email.",
      safe: true,
    };
  }

  const targetId = issue.missingTarget.split("/")[1];
  return {
    issueId: issue.issueId,
    type: "restore-target",
    severity: issue.severity,
    sourcePath: issue.sourcePath,
    referenceField: issue.referenceField,
    targetPath: issue.missingTarget,
    updatePath: issue.missingTarget,
    updateData: restoredContractorPayload(targetId, issue.sourcePath, sourceData),
    reason: candidates.length > 1
      ? "Multiple contractor candidates found; restored the missing target to avoid destructive relink."
      : "No contractor candidate found; restored the missing target document referenced by the user.",
    safe: true,
  };
}

async function resolveContractorUser(db: FirestoreDb, issue: BrokenReferenceIssue, sourceData: DocumentData | null): Promise<RepairOperation> {
  const targetUid = issue.missingTarget.split("/")[1];
  const email = asString(sourceData?.email) ?? asString(sourceData?.contactEmail);
  const candidates = unique([
    ...(await uniqueByField(db, "users", "email", email)),
  ]).filter((id) => id !== targetUid);

  if (candidates.length === 1 && !isArchivalCandidate(issue)) {
    return {
      issueId: issue.issueId,
      type: "relink-source",
      severity: issue.severity,
      sourcePath: issue.sourcePath,
      referenceField: issue.referenceField,
      targetPath: `users/${candidates[0]}`,
      updatePath: issue.sourcePath,
      updateData: {
        authUid: candidates[0],
        userId: candidates[0],
        updatedAt: nowIso(),
        integrityRepairedAt: nowIso(),
        integrityRepairStrategy: "RELINK",
      },
      reason: "Resolved a single canonical user from contractor email.",
      safe: true,
    };
  }

  return {
    issueId: issue.issueId,
    type: "restore-target",
    severity: issue.severity,
    sourcePath: issue.sourcePath,
    referenceField: issue.referenceField,
    targetPath: issue.missingTarget,
    updatePath: issue.missingTarget,
    updateData: restoredUserPayload(targetUid, issue.sourcePath, sourceData, issue),
    reason: isArchivalCandidate(issue)
      ? "Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references."
      : "Restored the missing user profile target referenced by the contractor.",
    safe: true,
  };
}

async function resolveVehicleReference(db: FirestoreDb, issue: BrokenReferenceIssue, sourceData: DocumentData | null): Promise<RepairOperation> {
  const vehicleId = issue.missingTarget.split("/").slice(1).join("/");
  const title = asString(sourceData?.vehicleTitle);
  const candidates = unique([
    ...(await uniqueByField(db, "inventory", "vehicleId", vehicleId)),
    ...(await uniqueByField(db, "inventory", "sourceVehicleId", vehicleId)),
    ...(await uniqueByField(db, "inventory", "stockNumber", vehicleId)),
    ...(await uniqueByField(db, "inventory", "vehicleTitle", title)),
  ]);

  if (candidates.length === 1) {
    return {
      issueId: issue.issueId,
      type: "relink-source",
      severity: issue.severity,
      sourcePath: issue.sourcePath,
      referenceField: issue.referenceField,
      targetPath: `inventory/${candidates[0]}`,
      updatePath: issue.sourcePath,
      updateData: {
        vehicleId: candidates[0],
        vehicleInventoryId: candidates[0],
        updatedAt: nowIso(),
        integrityRepairedAt: nowIso(),
        integrityRepairStrategy: "RELINK",
      },
      reason: "Resolved a single canonical inventory document.",
      safe: true,
    };
  }

  return {
    issueId: issue.issueId,
    type: "restore-target",
    severity: issue.severity,
    sourcePath: issue.sourcePath,
    referenceField: issue.referenceField,
    targetPath: issue.missingTarget,
    updatePath: issue.missingTarget,
    updateData: restoredInventoryPayload(vehicleId, issue.sourcePath, sourceData),
    reason: "Restored a non-available inventory target so vehicle finance applications keep their referenced vehicle.",
    safe: true,
  };
}

function resolveAuditUser(issue: BrokenReferenceIssue, sourceData: DocumentData | null): RepairOperation {
  const targetUid = issue.missingTarget.split("/")[1];
  return {
    issueId: issue.issueId,
    type: "restore-target",
    severity: issue.severity,
    sourcePath: issue.sourcePath,
    referenceField: issue.referenceField,
    targetPath: issue.missingTarget,
    updatePath: issue.missingTarget,
    updateData: restoredUserPayload(targetUid, issue.sourcePath, sourceData, issue),
    reason: "Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.",
    safe: true,
  };
}

export async function resolveRepairOperation(db: FirestoreDb, issue: BrokenReferenceIssue): Promise<RepairOperation> {
  const sourceData = await getData(db, issue.sourcePath);

  if (!sourceData) {
    return {
      issueId: issue.issueId,
      type: "manual-review",
      severity: issue.severity,
      sourcePath: issue.sourcePath,
      referenceField: issue.referenceField,
      targetPath: issue.missingTarget,
      reason: "Source document no longer exists; no repair was applied.",
      safe: false,
    };
  }

  if (issue.collection === "users" && issue.referenceField === "contractorId") {
    return resolveUserContractor(db, issue, sourceData);
  }

  if (issue.collection === "contractors" && (issue.referenceField === "authUid" || issue.referenceField === "userId")) {
    return resolveContractorUser(db, issue, sourceData);
  }

  if (issue.collection === "vehicleFinanceApplications" && issue.referenceField === "vehicleId") {
    return resolveVehicleReference(db, issue, sourceData);
  }

  if (issue.missingTarget.startsWith("users/") && (issue.collection === "auditLogs" || issue.collection === "tenderPackRequests")) {
    return resolveAuditUser(issue, sourceData);
  }

  return {
    issueId: issue.issueId,
    type: "manual-review",
    severity: issue.severity,
    sourcePath: issue.sourcePath,
    referenceField: issue.referenceField,
    targetPath: issue.missingTarget,
    reason: "No safe automated repair strategy is registered for this relationship.",
    safe: false,
  };
}

