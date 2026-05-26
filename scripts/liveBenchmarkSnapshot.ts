import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ getFirebaseAdmin }, { TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID }] = await Promise.all([
    import("../src/lib/firebase/admin"),
    import("../src/lib/contractors/ensureCanonicalContractorProfile"),
  ]);

  const db = getFirebaseAdmin();
  const contractorId = TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID;
  const contractorRef = db.collection("contractors").doc(contractorId);
  const [contractorSnap, documentsSnap, telemetrySnap, auditSnap] = await Promise.all([
    contractorRef.get(),
    contractorRef.collection("documents").get(),
    db.collection("complianceTelemetry").where("contractorId", "==", contractorId).limit(50).get(),
    db.collection("auditLogs").where("entityId", "==", contractorId).limit(50).get(),
  ]);

  const contractor = (contractorSnap.data() ?? {}) as Record<string, unknown>;
  const documents = documentsSnap.docs.map((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    return {
      id: doc.id,
      status: data.status ?? null,
      validationStatus: data.validationStatus ?? null,
      verified: data.verified ?? null,
      confidenceScore: data.confidenceScore ?? null,
      reviewReason: data.reviewReason ?? null,
      validationError: data.validationError ?? null,
      missingFields: data.missingFields ?? [],
      extractedFields: data.extractedFields ?? {},
    };
  });

  const latestTelemetry = sortByNewest(
    telemetrySnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) as Record<string, unknown> })),
    ["createdAt", "timestamp"],
  )[0] ?? null;
  const latestAudit = sortByNewest(
    auditSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) as Record<string, unknown> })),
    ["timestamp", "createdAt"],
  )[0] ?? null;

  console.log(JSON.stringify({
    contractorId,
    readinessScore: contractor.readinessScore ?? null,
    tenderLockStatus: contractor.tenderLockStatus ?? null,
    isTenderLocked: contractor.isTenderLocked ?? null,
    complianceApproved: contractor.complianceApproved ?? null,
    complianceConfidence: contractor.complianceConfidence ?? null,
    readinessConfidence: contractor.readinessConfidence ?? null,
    operationalSubmissionConfidence: contractor.operationalSubmissionConfidence ?? null,
    riskGrade: contractor.riskGrade ?? null,
    explainableSummary: contractor.explainableSummary ?? null,
    blockedReasons: contractor.blockedReasons ?? [],
    reviewRecommendations: contractor.reviewRecommendations ?? [],
    complianceDocumentBreakdown: contractor.complianceDocumentBreakdown ?? [],
    latestTelemetry,
    complianceTelemetryCount: telemetrySnap.size,
    latestAudit,
    auditLogCount: auditSnap.size,
    documents,
  }, null, 2));
}

function sortByNewest(items: Array<Record<string, unknown>>, keys: string[]) {
  return items.sort((left, right) => resolveTimestamp(right, keys) - resolveTimestamp(left, keys));
}

function resolveTimestamp(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
      return value.toMillis();
    }
    if (value && typeof value === "object" && "_seconds" in value) {
      const seconds = Number((value as { _seconds?: unknown })._seconds);
      const nanos = Number((value as { _nanoseconds?: unknown })._nanoseconds ?? 0);
      if (Number.isFinite(seconds)) return seconds * 1000 + Math.floor(nanos / 1_000_000);
    }
  }

  return 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
