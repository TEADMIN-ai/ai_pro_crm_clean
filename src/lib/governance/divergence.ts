import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  AUTHORITY_CLASSIFICATIONS,
  DIVERGENCE_CLASSIFICATIONS,
  ROUTE_CLASSIFICATIONS,
  type DivergenceClassification,
} from "@/lib/governance/classification";
import type { GovernanceContext } from "@/lib/governance/context";
import { emitGovernanceEvent } from "@/lib/governance/emitter";
import { resolveContractorDocumentStatus } from "@/lib/compliance/contractorCompliance";
import type { ContractorDocument } from "@/types/document";

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

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeDocument(source: Record<string, unknown>, id: string): ContractorDocument {
  return {
    id,
    contractorId: asString(source.contractorId) ?? "",
    documentType: asString(source.documentType) ?? asString(source.docType),
    docType: asString(source.docType),
    fileUrl: asString(source.fileUrl) ?? asString(source.downloadURL) ?? asString(source.url),
    downloadURL: asString(source.downloadURL) ?? asString(source.fileUrl),
    verified: source.verified === true || hasTimestamp(source.verifiedAt),
    verifiedAt: toMillis(source.verifiedAt),
    verifiedBy: asString(source.verifiedBy),
    validationError: asString(source.validationError),
    uploadedAt: toMillis(source.uploadedAt),
    updatedAt: toMillis(source.updatedAt),
    extractedAt: toMillis(source.extractedAt),
    expiresAt: typeof source.expiresAt === "number" ? source.expiresAt : toMillis(source.expiresAt),
    expiryDate: typeof source.expiryDate === "number" ? source.expiryDate : toMillis(source.expiryDate),
    confidenceScore: typeof source.confidenceScore === "number" ? source.confidenceScore : undefined,
    complianceScore: typeof source.complianceScore === "number" ? source.complianceScore : undefined,
    status: asString(source.status),
  };
}

function mapLegacyDocumentStatusToCanonicalStatus(status: string): string | null {
  const normalized = status.trim().toLowerCase();
  if (normalized === "approved") return "verified";
  if (normalized === "rejected") return "invalid";
  return null;
}

function emitDocumentComparisonEvent(params: {
  governanceContext: GovernanceContext;
  contractorId: string;
  documentId: string;
  documentType: string;
  legacyStatus: string;
  canonicalStatus: string;
  divergenceClassification: DivergenceClassification;
}) {
  const isMatch =
    params.divergenceClassification === DIVERGENCE_CLASSIFICATIONS.LEGACY_CANONICAL_STATUS_MATCH;

  emitGovernanceEvent({
    eventId: crypto.randomUUID(),
    eventVersion: "v1",
    occurredAt: new Date().toISOString(),
    category: "divergence_observation",
    eventType: isMatch ? "legacy_canonical_match_observed" : "legacy_canonical_divergence_observed",
    correlation: {
      correlationId: params.governanceContext.correlationId,
      requestId: params.governanceContext.requestId,
    },
    actor: {
      actorId: params.governanceContext.actor.actorId ?? null,
      actorEmail: params.governanceContext.actor.actorEmail ?? null,
      actorRole: params.governanceContext.actor.actorRole ?? null,
    },
    source: {
      sourceType: params.governanceContext.route.sourceType ?? "route",
      sourceName: params.governanceContext.route.sourceName,
      routePath: params.governanceContext.route.routePath ?? null,
      method: params.governanceContext.route.method ?? null,
      sourceClassification: params.governanceContext.route.sourceClassification ?? null,
    },
    entity: {
      entityType: "topLevelDocument",
      entityId: params.documentId,
      contractorId: params.contractorId,
      documentType: params.documentType,
    },
    governance: {
      routeClassification: params.governanceContext.route.sourceClassification ?? ROUTE_CLASSIFICATIONS.LEGACY,
      sourceClassification: params.governanceContext.route.sourceClassification ?? ROUTE_CLASSIFICATIONS.LEGACY,
      authorityClassification: AUTHORITY_CLASSIFICATIONS.BYPASS_WRITER,
      failOpen: true,
    },
    comparison: {
      comparedFields: ["status"],
      divergenceFields: isMatch ? [] : ["status"],
      divergenceClassification: params.divergenceClassification,
    },
  });
}

export function observeLegacyCanonicalDocumentStatus(params: {
  governanceContext: GovernanceContext;
  contractorId?: string | null;
  documentId: string;
  documentType?: string | null;
  legacyStatus: string;
}): void {
  const contractorId = params.contractorId?.trim();
  const documentType = params.documentType?.trim();
  const expectedCanonicalStatus = mapLegacyDocumentStatusToCanonicalStatus(params.legacyStatus);

  if (!contractorId || !documentType || !expectedCanonicalStatus) {
    return;
  }

  queueMicrotask(() => {
    void (async () => {
      try {
        const snapshot = await getFirebaseAdmin()
          .collection("contractors")
          .doc(contractorId)
          .collection("documents")
          .doc(documentType)
          .get();

        if (!snapshot.exists) {
          emitDocumentComparisonEvent({
            governanceContext: params.governanceContext,
            contractorId,
            documentId: params.documentId,
            documentType,
            legacyStatus: params.legacyStatus,
            canonicalStatus: "missing",
            divergenceClassification: DIVERGENCE_CLASSIFICATIONS.LEGACY_CANONICAL_STATUS_MISMATCH,
          });
          return;
        }

        const canonicalDocument = normalizeDocument(
          (snapshot.data() ?? {}) as Record<string, unknown>,
          snapshot.id
        );
        const canonicalStatus = resolveContractorDocumentStatus(canonicalDocument);
        const divergenceClassification =
          canonicalStatus === expectedCanonicalStatus
            ? DIVERGENCE_CLASSIFICATIONS.LEGACY_CANONICAL_STATUS_MATCH
            : DIVERGENCE_CLASSIFICATIONS.LEGACY_CANONICAL_STATUS_MISMATCH;

        emitDocumentComparisonEvent({
          governanceContext: params.governanceContext,
          contractorId,
          documentId: params.documentId,
          documentType,
          legacyStatus: params.legacyStatus,
          canonicalStatus,
          divergenceClassification,
        });
      } catch (error) {
        console.warn("[governance_divergence_observation_failed]", {
          sourceName: params.governanceContext.route.sourceName,
          documentId: params.documentId,
          contractorId,
          documentType,
          reason: error instanceof Error ? error.message : "Unknown divergence observation failure",
        });
      }
    })();
  });
}
