import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [
    { getFirebaseAdmin },
    { ensureCanonicalContractorProfile, TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID },
    { getDashboardAnalytics },
    { executeContractorDocumentAnalysis },
    { updateContractorIntelligence },
  ] =
    await Promise.all([
      import("../src/lib/firebase/admin"),
      import("../src/lib/contractors/ensureCanonicalContractorProfile"),
      import("../src/server/services/analyticsService"),
      import("../src/lib/documents/executeContractorDocumentAnalysis"),
      import("../src/lib/contractors/updateContractorIntelligence"),
    ]);

  const db = getFirebaseAdmin();
  const canonical = await ensureCanonicalContractorProfile(db);
  const contractorId = TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID;
  const contractorRef = db.collection("contractors").doc(contractorId);
  const executionResults = [];

  for (const documentType of ["cipc", "bbbee", "taxClearance", "coida", "bankConfirmation"] as const) {
    const execution = await executeContractorDocumentAnalysis({
      contractorId,
      documentType,
      actorEmail: "system@torque.empire",
      actorId: "system",
      writeActivity: false,
    });

    executionResults.push({
      documentType,
      status: execution.result.status,
      verified: execution.result.verified,
      score: execution.result.score,
      reason: execution.result.reason ?? null,
      missingFields: execution.result.missingFields,
      extractedFields: execution.result.extractedFields,
    });
  }

  const intelligenceUpdate = await updateContractorIntelligence(db, contractorId);
  const [contractorSnap, documentsSnap, telemetrySnap, auditSnap] = await Promise.all([
    contractorRef.get(),
    contractorRef.collection("documents").get(),
    db.collection("complianceTelemetry").where("contractorId", "==", contractorId).limit(50).get(),
    db.collection("auditLogs").where("entityId", "==", contractorId).limit(50).get(),
  ]);

  const contractorData = (contractorSnap.data() ?? {}) as Record<string, unknown>;
  const documents = documentsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() ?? {}),
  }));

  const executive = await getDashboardAnalytics({
    uid: "system",
    email: "system@torque.empire",
    role: "admin",
  });

  const sortByNewestTimestamp = (items: Array<Record<string, unknown>>, keys: string[]) =>
    items.sort((left, right) => {
      const leftTime = resolveTimestamp(left, keys);
      const rightTime = resolveTimestamp(right, keys);
      return rightTime - leftTime;
    });

  const summary = {
    canonical,
    contractorId,
    executionResults,
    intelligenceUpdate,
    contractor: contractorData,
    documents,
    complianceTelemetryCount: telemetrySnap.size,
    latestComplianceTelemetry: sortByNewestTimestamp(
      telemetrySnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() ?? {}),
      })),
      ["createdAt", "timestamp"],
    ).slice(0, 10),
    auditLogCount: auditSnap.size,
    latestAuditLogs: sortByNewestTimestamp(
      auditSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() ?? {}),
      })),
      ["timestamp", "createdAt"],
    ).slice(0, 10),
    executiveMetrics: executive.executiveMetrics.complianceSummary,
  };

  console.log(JSON.stringify(summary, null, 2));
}

function resolveTimestamp(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
      return value.toMillis();
    }

    if (value && typeof value === "object" && "_seconds" in value) {
      const seconds = Number((value as { _seconds?: unknown })._seconds);
      const nanos = Number((value as { _nanoseconds?: unknown })._nanoseconds ?? 0);
      if (Number.isFinite(seconds)) {
        return seconds * 1000 + Math.floor(nanos / 1_000_000);
      }
    }
  }

  return 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
