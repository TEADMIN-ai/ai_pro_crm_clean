import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  AuthorizationError,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  AUTHORITY_CLASSIFICATIONS,
  MUTATION_CLASSIFICATIONS,
  ROUTE_CLASSIFICATIONS,
} from "@/lib/governance/classification";
import { observeLegacyCanonicalDocumentStatus } from "@/lib/governance/divergence";
import { emitGovernanceEvent } from "@/lib/governance/emitter";
import { withGovernanceObservation } from "@/lib/governance/observer";
import { generateFixSuggestion } from "@/lib/services/aiFixService";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";

function scheduleCanonicalStatusObservation(params: Parameters<typeof observeLegacyCanonicalDocumentStatus>[0]) {
  queueMicrotask(() => {
    try {
      observeLegacyCanonicalDocumentStatus(params);
    } catch (error) {
      console.warn("[governance_divergence_observation_failed]", {
        sourceName: params.governanceContext.route.sourceName,
        documentId: params.documentId,
        contractorId: params.contractorId ?? null,
        documentType: params.documentType ?? null,
        reason:
          error instanceof Error
            ? error.message
            : "Unknown divergence observation scheduling failure",
      });
    }
  });
}

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export const PATCH = withGovernanceObservation(
  {
    sourceName: "top_level_document_patch",
    routePath: "/api/documents/[documentId]",
    method: "PATCH",
    sourceType: "route",
    sourceClassification: ROUTE_CLASSIFICATIONS.HYBRID,
  },
  async (request: NextRequest, context: RouteContext, governanceContext) => {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const { documentId } = await context.params;
    if (!documentId) {
      return jsonError("Document ID is required", 400);
    }

    const payload = (await request.json().catch(() => null)) as { status?: unknown } | null;
    const status = typeof payload?.status === "string" ? payload.status.trim().toLowerCase() : "";

    if (status !== "approved" && status !== "rejected") {
      return jsonError("Invalid status", 400);
    }

    const db = getFirebaseAdmin();
    const docRef = db.collection("documents").doc(documentId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return jsonError("Document not found", 404);
    }

    const existing = snapshot.data() ?? {};
    const existingContractorId =
      typeof existing.contractorId === "string" && existing.contractorId.trim().length > 0
        ? existing.contractorId.trim()
        : null;

    emitGovernanceEvent({
      eventId: crypto.randomUUID(),
      eventVersion: "v1",
      occurredAt: new Date().toISOString(),
      category: "legacy_mutation",
      eventType: "legacy_top_level_document_status_write",
      correlation: {
        correlationId: governanceContext.correlationId,
        requestId: governanceContext.requestId,
      },
      actor: {
        actorId: user.uid,
        actorEmail: user.email?.trim() || null,
        actorRole: user.role,
      },
      source: {
        sourceType: "route",
        sourceName: governanceContext.route.sourceName,
        routePath: governanceContext.route.routePath ?? null,
        method: governanceContext.route.method ?? request.method,
        sourceClassification: governanceContext.route.sourceClassification ?? null,
      },
      entity: {
        entityType: "topLevelDocument",
        entityId: documentId,
        contractorId: existingContractorId,
      },
      mutation: {
        mutationType: MUTATION_CLASSIFICATIONS.LEGACY_TOP_LEVEL_DOCUMENT_STATUS_WRITE,
        mutatedFields: ["status", "reviewedAt", "reviewedBy", "fixSuggestion", "updatedAt"],
      },
      governance: {
        routeClassification: ROUTE_CLASSIFICATIONS.HYBRID,
        sourceClassification: governanceContext.route.sourceClassification ?? null,
        authorityClassification: AUTHORITY_CLASSIFICATIONS.DERIVED_WRITER,
        failOpen: true,
      },
    });

    emitGovernanceEvent({
      eventId: crypto.randomUUID(),
      eventVersion: "v1",
      occurredAt: new Date().toISOString(),
      category: "legacy_mutation",
      eventType: "legacy_document_mutation_observed",
      correlation: {
        correlationId: governanceContext.correlationId,
        requestId: governanceContext.requestId,
      },
      actor: {
        actorId: user.uid,
        actorEmail: user.email?.trim() || null,
        actorRole: user.role,
      },
      source: {
        sourceType: "route",
        sourceName: governanceContext.route.sourceName,
        routePath: governanceContext.route.routePath ?? null,
        method: governanceContext.route.method ?? request.method,
        sourceClassification: governanceContext.route.sourceClassification ?? null,
      },
      entity: {
        entityType: "topLevelDocument",
        entityId: documentId,
        contractorId: existingContractorId,
      },
      mutation: {
        mutationType: MUTATION_CLASSIFICATIONS.LEGACY_TOP_LEVEL_DOCUMENT_STATUS_WRITE,
        mutatedFields: ["status"],
      },
      governance: {
        routeClassification: ROUTE_CLASSIFICATIONS.HYBRID,
        sourceClassification: governanceContext.route.sourceClassification ?? null,
        authorityClassification: AUTHORITY_CLASSIFICATIONS.DERIVED_WRITER,
        failOpen: true,
      },
    });

    await docRef.update({
      status,
      reviewedAt: Date.now(),
      reviewedBy: user.uid,
      fixSuggestion: status === "rejected" ? FieldValue.delete() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    let updatedSnapshot = await docRef.get();
    let updated = updatedSnapshot.data() ?? {};

    let fixSuggestion: string | null = null;

    if (status === "rejected") {
      fixSuggestion = await generateFixSuggestion(updated);
      await docRef.update({
        fixSuggestion,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updatedSnapshot = await docRef.get();
      updated = updatedSnapshot.data() ?? {};
    }

    const contractorId =
      typeof updated.contractorId === "string" && updated.contractorId.trim().length > 0
        ? updated.contractorId.trim()
        : undefined;

    if (contractorId) {
      await recalculateContractorCompliance(db, contractorId, governanceContext);
    }

    scheduleCanonicalStatusObservation({
      governanceContext,
      contractorId: contractorId ?? existingContractorId,
      documentId,
      documentType:
        typeof existing.documentType === "string"
          ? existing.documentType
          : typeof existing.docType === "string"
            ? existing.docType
            : null,
      legacyStatus: status,
    });

    return NextResponse.json(
      {
        success: true,
        document: {
          id: updatedSnapshot.id,
          status: typeof updated.status === "string" ? updated.status : status,
          fixSuggestion:
            typeof updated.fixSuggestion === "string"
              ? updated.fixSuggestion
              : fixSuggestion,
          reviewedAt:
            typeof updated.reviewedAt === "number"
              ? updated.reviewedAt
              : updated.reviewedAt &&
                  typeof updated.reviewedAt === "object" &&
                  "toMillis" in updated.reviewedAt &&
                  typeof updated.reviewedAt.toMillis === "function"
                ? updated.reviewedAt.toMillis()
                : Date.now(),
          reviewedBy: typeof updated.reviewedBy === "string" ? updated.reviewedBy : user.uid,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Document approval update failed", error);
    return jsonError("Failed to update document status", 500);
  }
});
