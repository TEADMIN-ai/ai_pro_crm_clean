import type { Firestore } from "firebase-admin/firestore";
import { buildContractorComplianceIntelligence } from "@/lib/compliance/contractorComplianceIntelligence";
import { persistComplianceOperationalEvents } from "@/lib/compliance/complianceOperationalEvents";
import { AUTHORITY_CLASSIFICATIONS, ROUTE_CLASSIFICATIONS } from "@/lib/governance/classification";
import { createGovernanceContext, type GovernanceContext } from "@/lib/governance/context";
import { emitGovernanceEvent } from "@/lib/governance/emitter";
import { DIVERGENCE_CLASSIFICATIONS } from "@/lib/governance/classification";
import {
  calculateContractorCompliance,
  LEGACY_COMPLIANCE_REQUIREMENT_KEYS,
  resolveContractorDocumentStatus,
  toLegacyComplianceRequirementKey,
  type LegacyComplianceRequirementKey,
} from "@/lib/compliance/contractorCompliance";
import type { ContractorDocument } from "@/types/document";

type LegacyContractorDocumentState = {
  uploaded: boolean;
  valid: boolean;
  status: ContractorDocument["status"] | "missing";
  documentType: string;
  updatedAt: string | null;
};

function removeUndefinedFields<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

export function sanitizeComplianceDocumentBreakdownForFirestore(
  breakdown: ReturnType<typeof buildContractorComplianceIntelligence>["documentBreakdown"],
) {
  return breakdown.map((item) =>
    removeUndefinedFields({
      ...item,
      taxDocumentCategory: item.taxDocumentCategory ?? null,
      taxDocumentPurpose: item.taxDocumentPurpose ?? null,
      taxClassificationConfidence: item.taxClassificationConfidence ?? null,
      taxComplianceCapable: item.taxComplianceCapable ?? null,
      taxSupportingOnly: item.taxSupportingOnly ?? null,
      readinessImpactReason: item.readinessImpactReason ?? null,
    }),
  );
}

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return undefined;
}

function hasTimestamp(value: unknown): boolean {
  return typeof toMillis(value) === "number";
}

function normalizeContractorDocument(id: string, source: Record<string, unknown>): ContractorDocument {
  const document: ContractorDocument = {
    id,
    contractorId: typeof source.contractorId === "string" ? source.contractorId : "",
    documentName: typeof source.documentName === "string" ? source.documentName : undefined,
    documentType:
      typeof source.documentType === "string"
        ? source.documentType
        : typeof source.docType === "string"
          ? source.docType
          : undefined,
    complianceType: typeof source.complianceType === "string" ? source.complianceType : undefined,
    docType: typeof source.docType === "string" ? source.docType : undefined,
    fileUrl:
      typeof source.fileUrl === "string"
        ? source.fileUrl
        : typeof source.downloadURL === "string"
          ? source.downloadURL
          : typeof source.url === "string"
            ? source.url
            : undefined,
    downloadURL:
      typeof source.downloadURL === "string"
        ? source.downloadURL
        : typeof source.fileUrl === "string"
          ? source.fileUrl
          : undefined,
    storagePath: typeof source.storagePath === "string" ? source.storagePath : undefined,
    fileName:
      typeof source.fileName === "string"
        ? source.fileName
        : typeof source.documentName === "string"
          ? source.documentName
          : undefined,
    verified: source.verified === true || hasTimestamp(source.verifiedAt),
    verifiedAt: toMillis(source.verifiedAt),
    verifiedBy: typeof source.verifiedBy === "string" ? source.verifiedBy : undefined,
    validationError: typeof source.validationError === "string" ? source.validationError : undefined,
    uploadedAt: toMillis(source.uploadedAt),
    updatedAt: toMillis(source.updatedAt),
    extractedAt: toMillis(source.extractedAt),
    expiresAt: typeof source.expiresAt === "number" ? source.expiresAt : toMillis(source.expiresAt),
    expiryDate: typeof source.expiryDate === "number" ? source.expiryDate : toMillis(source.expiryDate),
    expiryAlert:
      source.expiryAlert === "expired" || source.expiryAlert === "expiringSoon" || source.expiryAlert === "none"
        ? source.expiryAlert
        : undefined,
    expiryAlertMessage: typeof source.expiryAlertMessage === "string" ? source.expiryAlertMessage : undefined,
    confidenceScore: typeof source.confidenceScore === "number" ? source.confidenceScore : undefined,
    complianceScore: typeof source.complianceScore === "number" ? source.complianceScore : undefined,
    taxDocumentCategory: typeof source.taxDocumentCategory === "string" ? source.taxDocumentCategory as ContractorDocument["taxDocumentCategory"] : undefined,
    taxDocumentPurpose: typeof source.taxDocumentPurpose === "string" ? source.taxDocumentPurpose as ContractorDocument["taxDocumentPurpose"] : undefined,
    taxClassificationConfidence: typeof source.taxClassificationConfidence === "number" ? source.taxClassificationConfidence : undefined,
    taxComplianceCapable: typeof source.taxComplianceCapable === "boolean" ? source.taxComplianceCapable : undefined,
    taxSupportingOnly: typeof source.taxSupportingOnly === "boolean" ? source.taxSupportingOnly : undefined,
    readinessImpactReason: typeof source.readinessImpactReason === "string" ? source.readinessImpactReason : undefined,
    extractedFields:
      source.extractedFields && typeof source.extractedFields === "object"
        ? (source.extractedFields as Record<string, string | null>)
        : undefined,
    status: typeof source.status === "string" ? source.status : undefined,
  };

  return {
    ...document,
    status: resolveContractorDocumentStatus(document),
  };
}

export async function recalculateContractorCompliance(
  db: Firestore,
  contractorId: string,
  governanceContextInput?: GovernanceContext
) {
  const governanceContext = governanceContextInput ?? createGovernanceContext({
    route: {
      sourceName: "recalculateContractorCompliance",
      sourceType: "service",
      sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
    },
  });
  const startedAt = Date.now();

  emitGovernanceEvent({
    eventId: crypto.randomUUID(),
    eventVersion: "v1",
    occurredAt: new Date().toISOString(),
    category: "recomputation",
    eventType: "contractor_readiness_recompute_started",
    correlation: {
      correlationId: governanceContext.correlationId,
      requestId: governanceContext.requestId,
    },
    actor: {
      actorId: governanceContext.actor.actorId ?? null,
      actorEmail: governanceContext.actor.actorEmail ?? null,
      actorRole: governanceContext.actor.actorRole ?? null,
    },
    source: {
      sourceType: "service",
      sourceName: "recalculateContractorCompliance",
      routePath: governanceContext.route.routePath ?? null,
      method: governanceContext.route.method ?? null,
      sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
    },
    entity: {
      entityType: "contractor",
      entityId: contractorId,
      contractorId,
    },
    governance: {
      routeClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
      sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
      authorityClassification: AUTHORITY_CLASSIFICATIONS.SOURCE_OF_TRUTH,
      failOpen: true,
    },
  });

  try {
  const contractorRef = db.collection("contractors").doc(contractorId);
  const contractorSnapshot = await contractorRef.get();
  const contractorData = (contractorSnapshot.data() ?? {}) as Record<string, unknown>;
  const readinessBefore = {
    readinessScore: contractorData.readinessScore ?? null,
    docsMissing: contractorData.docsMissing ?? null,
    complianceApproved: contractorData.complianceApproved ?? null,
    tenderLockStatus: contractorData.tenderLockStatus ?? null,
    isTenderLocked: contractorData.isTenderLocked ?? null,
    complianceConfidence: contractorData.complianceConfidence ?? null,
    readinessConfidence: contractorData.readinessConfidence ?? null,
    operationalSubmissionConfidence: contractorData.operationalSubmissionConfidence ?? null,
    riskGrade: contractorData.riskGrade ?? null,
  };
  const documentsSnapshot = await contractorRef.collection("documents").get();
  const documents = documentsSnapshot.docs.map((doc) =>
    normalizeContractorDocument(doc.id, (doc.data() ?? {}) as Record<string, unknown>)
  );
  const summary = calculateContractorCompliance(documents);
  const intelligence = buildContractorComplianceIntelligence(contractorId, documents, summary);
  const complianceDocumentBreakdown = sanitizeComplianceDocumentBreakdownForFirestore(intelligence.documentBreakdown);
  const readinessUpdatedAt = new Date().toISOString();
  const legacyDocuments = buildLegacyDocumentsState(documents, readinessUpdatedAt);
  const complianceApproved =
    summary.docsMissing === 0 &&
    summary.expiredDocumentCount === 0 &&
    summary.tenderLockStatus === "READY" &&
    LEGACY_COMPLIANCE_REQUIREMENT_KEYS
      .filter((key) => key !== "bank")
      .every((key) => legacyDocuments[key]?.valid === true) &&
    legacyDocuments.bank?.valid === true;

  await contractorRef.set(
    {
      readinessScore: summary.readinessScore,
      docsMissing: summary.docsMissing,
      tenderLockStatus: summary.tenderLockStatus,
      isTenderLocked: summary.isTenderLocked,
      complianceStatusScore: summary.complianceStatusScore,
      expiredDocumentCount: summary.expiredDocumentCount,
      expiringSoonCount: summary.expiringSoonCount,
      activeComplianceAlerts: summary.activeAlerts,
      missingDocumentTypes: summary.missingDocumentTypes,
      complianceCompleted: LEGACY_COMPLIANCE_REQUIREMENT_KEYS.length - summary.docsMissing,
      complianceMissing: summary.docsMissing,
      complianceCompletedTypes: LEGACY_COMPLIANCE_REQUIREMENT_KEYS.filter(
        (key) => legacyDocuments[key]?.valid === true
      ),
      complianceMissingTypes: Object.entries(legacyDocuments)
        .filter(([, value]) => value.valid !== true)
        .map(([key]) => key),
      complianceApproved,
      complianceConfidence: intelligence.complianceConfidence,
      readinessConfidence: intelligence.readinessConfidence,
      operationalSubmissionConfidence: intelligence.operationalSubmissionConfidence,
      riskGrade: intelligence.riskGrade,
      explainableSummary: intelligence.explainableSummary,
      blockedReasons: intelligence.blockedReasons,
      reviewRecommendations: intelligence.reviewRecommendations,
      missingCriticalDocuments: intelligence.missingCriticalDocuments,
      verifiedCriticalDocuments: intelligence.verifiedCriticalDocuments,
      averageDocumentConfidence: intelligence.averageDocumentConfidence,
      complianceDocumentBreakdown,
      telemetrySummary: intelligence.telemetry,
      documents: legacyDocuments,
      readinessUpdatedAt,
      updatedAt: readinessUpdatedAt,
    },
    { merge: true }
  );

  const dealsSnapshot = await db.collection("deals").where("contractorId", "==", contractorId).get();
  if (!dealsSnapshot.empty) {
    const batch = db.batch();

    for (const dealDoc of dealsSnapshot.docs) {
      batch.set(
        dealDoc.ref,
        {
          readinessScore: summary.readinessScore,
          docsMissing: summary.docsMissing,
          tenderLockStatus: summary.tenderLockStatus,
          isTenderLocked: summary.isTenderLocked,
          readinessUpdatedAt,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  }

  const readinessAfter = {
    readinessScore: summary.readinessScore,
    docsMissing: summary.docsMissing,
    complianceApproved,
    tenderLockStatus: summary.tenderLockStatus,
    isTenderLocked: summary.isTenderLocked,
    complianceConfidence: intelligence.complianceConfidence,
    readinessConfidence: intelligence.readinessConfidence,
    operationalSubmissionConfidence: intelligence.operationalSubmissionConfidence,
    riskGrade: intelligence.riskGrade,
  };

  await persistComplianceOperationalEvents({
    db,
    contractorId,
    before: contractorData,
    intelligence,
    summary,
  });

  console.log("[READINESS_RECOMPUTED]", {
    contractorId,
    readiness: summary.readinessScore,
    verifiedDocs: documents.filter((document) => document.verified === true).length,
    missingDocs: summary.missingDocumentTypes,
    expiredDocumentCount: summary.expiredDocumentCount,
    expiringSoonCount: summary.expiringSoonCount,
    verifiedDocumentTypes: documents
      .filter((document) => document.verified === true)
      .map((document) => ({
        documentType: document.documentType ?? document.docType ?? document.id,
        status: document.status,
        verified: document.verified === true,
        expiresAt: document.expiresAt ?? null,
        validationError: document.validationError ?? null,
      })),
    readinessBefore,
    readinessAfter,
    explainableSummary: intelligence.explainableSummary,
    blockedReasons: intelligence.blockedReasons,
    reviewRecommendations: intelligence.reviewRecommendations,
  });

  console.log("[TENDER_UNLOCK_STATUS]", {
    contractorId,
    readiness: summary.readinessScore,
    tenderLockStatus: summary.tenderLockStatus,
    isTenderLocked: summary.isTenderLocked,
    complianceApproved,
    docsMissing: summary.docsMissing,
    expiredDocumentCount: summary.expiredDocumentCount,
  });

  const legacyTriggeredRecompute =
    governanceContext.route.sourceClassification === ROUTE_CLASSIFICATIONS.LEGACY ||
    governanceContext.route.sourceClassification === ROUTE_CLASSIFICATIONS.HYBRID;
  const readinessChanged =
    readinessBefore.readinessScore !== summary.readinessScore ||
    readinessBefore.docsMissing !== summary.docsMissing ||
    readinessBefore.tenderLockStatus !== summary.tenderLockStatus ||
    readinessBefore.isTenderLocked !== summary.isTenderLocked;

  if (legacyTriggeredRecompute && readinessChanged) {
    const divergenceFields = ["readinessScore", "docsMissing", "tenderLockStatus", "isTenderLocked"].filter((field) => {
      switch (field) {
        case "readinessScore":
          return readinessBefore.readinessScore !== summary.readinessScore;
        case "docsMissing":
          return readinessBefore.docsMissing !== summary.docsMissing;
        case "tenderLockStatus":
          return readinessBefore.tenderLockStatus !== summary.tenderLockStatus;
        case "isTenderLocked":
          return readinessBefore.isTenderLocked !== summary.isTenderLocked;
        default:
          return false;
      }
    });
    emitGovernanceEvent({
      eventId: crypto.randomUUID(),
      eventVersion: "v1",
      occurredAt: new Date().toISOString(),
      category: "divergence_observation",
      eventType: "stale_state_compensation_observed",
      correlation: {
        correlationId: governanceContext.correlationId,
        requestId: governanceContext.requestId,
      },
      actor: {
        actorId: governanceContext.actor.actorId ?? null,
        actorEmail: governanceContext.actor.actorEmail ?? null,
        actorRole: governanceContext.actor.actorRole ?? null,
      },
      source: {
        sourceType: "service",
        sourceName: "recalculateContractorCompliance",
        routePath: governanceContext.route.routePath ?? null,
        method: governanceContext.route.method ?? null,
        sourceClassification: governanceContext.route.sourceClassification ?? null,
      },
      entity: {
        entityType: "contractor",
        entityId: contractorId,
        contractorId,
      },
      governance: {
        routeClassification: governanceContext.route.sourceClassification ?? ROUTE_CLASSIFICATIONS.HYBRID,
        sourceClassification: governanceContext.route.sourceClassification ?? ROUTE_CLASSIFICATIONS.HYBRID,
        authorityClassification: AUTHORITY_CLASSIFICATIONS.SOURCE_OF_TRUTH,
        failOpen: true,
      },
      comparison: {
        comparedFields: ["readinessScore", "docsMissing", "tenderLockStatus", "isTenderLocked"],
        divergenceFields: divergenceFields,
        divergenceClassification: DIVERGENCE_CLASSIFICATIONS.STALE_STATE_COMPENSATION,
        staleStateDetected: true,
        changedState: true,
      },
    });

    if (governanceContext.route.sourceName === "top_level_document_patch") {
      emitGovernanceEvent({
        eventId: crypto.randomUUID(),
        eventVersion: "v1",
        occurredAt: new Date().toISOString(),
        category: "divergence_observation",
        eventType: "canonical_overwrite_after_legacy_write_observed",
        correlation: {
          correlationId: governanceContext.correlationId,
          requestId: governanceContext.requestId,
        },
        actor: {
          actorId: governanceContext.actor.actorId ?? null,
          actorEmail: governanceContext.actor.actorEmail ?? null,
          actorRole: governanceContext.actor.actorRole ?? null,
        },
        source: {
          sourceType: "service",
          sourceName: "recalculateContractorCompliance",
          routePath: governanceContext.route.routePath ?? null,
          method: governanceContext.route.method ?? null,
          sourceClassification: governanceContext.route.sourceClassification ?? null,
        },
        entity: {
          entityType: "contractor",
          entityId: contractorId,
          contractorId,
        },
        governance: {
          routeClassification: governanceContext.route.sourceClassification ?? ROUTE_CLASSIFICATIONS.HYBRID,
          sourceClassification: governanceContext.route.sourceClassification ?? ROUTE_CLASSIFICATIONS.HYBRID,
          authorityClassification: AUTHORITY_CLASSIFICATIONS.SOURCE_OF_TRUTH,
          failOpen: true,
        },
        comparison: {
          comparedFields: ["readinessScore", "docsMissing", "tenderLockStatus", "isTenderLocked"],
          divergenceFields: divergenceFields,
          divergenceClassification: DIVERGENCE_CLASSIFICATIONS.CANONICAL_OVERWRITE_AFTER_LEGACY_WRITE,
          staleStateDetected: true,
          changedState: true,
        },
      });
    }
  }

  emitGovernanceEvent({
    eventId: crypto.randomUUID(),
    eventVersion: "v1",
    occurredAt: new Date().toISOString(),
    category: "recomputation",
    eventType: "contractor_readiness_recompute_completed",
    correlation: {
      correlationId: governanceContext.correlationId,
      requestId: governanceContext.requestId,
    },
    actor: {
      actorId: governanceContext.actor.actorId ?? null,
      actorEmail: governanceContext.actor.actorEmail ?? null,
      actorRole: governanceContext.actor.actorRole ?? null,
    },
    source: {
      sourceType: "service",
      sourceName: "recalculateContractorCompliance",
      routePath: governanceContext.route.routePath ?? null,
      method: governanceContext.route.method ?? null,
      sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
    },
    entity: {
      entityType: "contractor",
      entityId: contractorId,
      contractorId,
    },
    mutation: {
      mutatedFields: ["readinessScore", "docsMissing", "tenderLockStatus", "isTenderLocked", "readinessUpdatedAt"],
    },
    governance: {
      routeClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
      sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
      authorityClassification: AUTHORITY_CLASSIFICATIONS.SOURCE_OF_TRUTH,
      latencyMs: Date.now() - startedAt,
      failOpen: true,
    },
  });

  return {
    ...summary,
    complianceApproved,
    legacyDocuments,
    readinessUpdatedAt,
    intelligence,
  };
  } catch (error) {
    emitGovernanceEvent({
      eventId: crypto.randomUUID(),
      eventVersion: "v1",
      occurredAt: new Date().toISOString(),
      category: "recomputation",
      eventType: "contractor_readiness_recompute_failed",
      correlation: {
        correlationId: governanceContext.correlationId,
        requestId: governanceContext.requestId,
      },
      actor: {
        actorId: governanceContext.actor.actorId ?? null,
        actorEmail: governanceContext.actor.actorEmail ?? null,
        actorRole: governanceContext.actor.actorRole ?? null,
      },
      source: {
        sourceType: "service",
        sourceName: "recalculateContractorCompliance",
        routePath: governanceContext.route.routePath ?? null,
        method: governanceContext.route.method ?? null,
        sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
      },
      entity: {
        entityType: "contractor",
        entityId: contractorId,
        contractorId,
      },
      governance: {
        routeClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
        sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
        authorityClassification: AUTHORITY_CLASSIFICATIONS.SOURCE_OF_TRUTH,
        latencyMs: Date.now() - startedAt,
        failOpen: true,
      },
    });

    throw error;
  }
}

function buildLegacyDocumentsState(
  documents: ContractorDocument[],
  readinessUpdatedAt: string
): Record<LegacyComplianceRequirementKey, LegacyContractorDocumentState> {
  const legacyDocuments = Object.fromEntries(
    LEGACY_COMPLIANCE_REQUIREMENT_KEYS.map((key) => [
      key,
      {
        uploaded: false,
        valid: false,
        status: "missing",
        documentType: key === "tax" ? "taxClearance" : key === "bank" ? "bankConfirmation" : key,
        updatedAt: null,
      } satisfies LegacyContractorDocumentState,
    ])
  ) as Record<LegacyComplianceRequirementKey, LegacyContractorDocumentState>;

  for (const document of documents) {
    const legacyKey = toLegacyComplianceRequirementKey(document.documentType ?? document.docType);
    if (!legacyKey) {
      continue;
    }

    const status = resolveContractorDocumentStatus(document);
    const current = legacyDocuments[legacyKey];
    const next: LegacyContractorDocumentState = {
      uploaded: Boolean(document.fileUrl),
      valid: status === "verified" || status === "expiringSoon",
      status,
      documentType: document.documentType ?? document.docType ?? current.documentType,
      updatedAt: readinessUpdatedAt,
    };

    if (shouldReplaceLegacyState(current, next)) {
      legacyDocuments[legacyKey] = next;
    }
  }

  return legacyDocuments;
}

function shouldReplaceLegacyState(
  current: LegacyContractorDocumentState,
  next: LegacyContractorDocumentState
): boolean {
  return rankLegacyState(next) >= rankLegacyState(current);
}

function rankLegacyState(state: LegacyContractorDocumentState): number {
  if (state.valid) return 5;
  if (state.status === "expiringSoon") return 4;
  if (state.status === "uploaded") return 3;
  if (state.status === "invalid") return 2;
  if (state.uploaded) return 1;
  return 0;
}
