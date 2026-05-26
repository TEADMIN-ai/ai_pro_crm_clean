import { NextRequest } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  AUTHORITY_CLASSIFICATIONS,
  MUTATION_CLASSIFICATIONS,
  ROUTE_CLASSIFICATIONS,
} from "@/lib/governance/classification";
import { observeLegacyCanonicalDocumentStatus } from "@/lib/governance/divergence";
import { emitGovernanceEvent } from "@/lib/governance/emitter";
import { withGovernanceObservation } from "@/lib/governance/observer";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";

export const PATCH = withGovernanceObservation(
  {
    sourceName: "top_level_document_status_patch",
    routePath: "/api/documents/[documentId]/status",
    method: "PATCH",
    sourceType: "route",
    sourceClassification: ROUTE_CLASSIFICATIONS.LEGACY,
  },
  async (request: NextRequest, _context: unknown, governanceContext) => {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const userId = user.uid;

    // BULLETPROOF PARAM EXTRACTION
    const url = new URL(request.url);
    const documentId = url.pathname.split("/")[3];

    console.log("Incoming documentId:", documentId);

    if (!documentId || typeof documentId !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid documentId" }),
        { status: 400 }
      );
    }

    const db = getFirebaseAdmin();

    const docRef = db.collection("documents").doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404 }
      );
    }

    const existing = docSnap.data();
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return new Response(
        JSON.stringify({ error: "Missing status" }),
        { status: 400 }
      );
    }

    const contractorId =
      existing && typeof existing.contractorId === "string" && existing.contractorId.trim().length > 0
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
        contractorId,
      },
      mutation: {
        mutationType: MUTATION_CLASSIFICATIONS.LEGACY_TOP_LEVEL_DOCUMENT_STATUS_WRITE,
        mutatedFields: ["status", "updatedAt", "lastActionBy", "lastActionAt", "lastActionType", "auditTrail"],
      },
      governance: {
        routeClassification: ROUTE_CLASSIFICATIONS.LEGACY,
        sourceClassification: governanceContext.route.sourceClassification ?? null,
        authorityClassification: AUTHORITY_CLASSIFICATIONS.BYPASS_WRITER,
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
        contractorId,
      },
      mutation: {
        mutationType: MUTATION_CLASSIFICATIONS.LEGACY_TOP_LEVEL_DOCUMENT_STATUS_WRITE,
        mutatedFields: ["status"],
      },
      governance: {
        routeClassification: ROUTE_CLASSIFICATIONS.LEGACY,
        sourceClassification: governanceContext.route.sourceClassification ?? null,
        authorityClassification: AUTHORITY_CLASSIFICATIONS.BYPASS_WRITER,
        failOpen: true,
      },
    });

    await docRef.update({
      status,
      updatedAt: new Date().toISOString(),

      // LAST ACTION (for UI display)
      lastActionBy: userId,
      lastActionAt: new Date().toISOString(),
      lastActionType: status,

      // FULL AUDIT TRAIL (append only)
      auditTrail: [
        ...(existing?.auditTrail || []),
        {
          action: status,
          by: userId,
          at: new Date().toISOString(),
        },
      ],
    });

    observeLegacyCanonicalDocumentStatus({
      governanceContext,
      contractorId,
      documentId,
      documentType:
        existing && typeof existing.documentType === "string"
          ? existing.documentType
          : existing && typeof existing.docType === "string"
            ? existing.docType
            : null,
      legacyStatus: status,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.status });
    }

    console.error("Status update failed:", error);

    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500 }
    );
  }
});
