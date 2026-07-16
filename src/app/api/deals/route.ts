export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  AUTHORITY_CLASSIFICATIONS,
  DIVERGENCE_CLASSIFICATIONS,
  MUTATION_CLASSIFICATIONS,
  ROUTE_CLASSIFICATIONS,
} from "@/lib/governance/classification";
import type { GovernanceContext } from "@/lib/governance/context";
import { emitGovernanceEvent } from "@/lib/governance/emitter";
import { withGovernanceObservation } from "@/lib/governance/observer";
import { AuthorizationError, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { generateAIInsights } from "@/lib/ai/generateInsights";
import { calculateReadiness } from "@/lib/engine/readinessEngine";
import { generateFixSuggestions } from "@/lib/engine/fixSuggestions";
import { analyzeTenderText } from "@/lib/tenderAnalysisService";
import { getContractorBusinessName, resolveContractorReference } from "@/lib/contractors/contractorReferenceResolver";

const db = getFirebaseAdmin();

const AI_INSIGHTS_TTL_MS = 1000 * 60 * 60 * 24;

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function arraysEqual(left: unknown, right: unknown): boolean {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function getChangedReadinessFields(data: Record<string, unknown>, readiness: ReturnType<typeof calculateReadiness>): string[] {
  const changedFields: string[] = [];

  if (data.readinessScore !== readiness.readinessScore) {
    changedFields.push("readinessScore");
  }

  if (data.riskLevel !== readiness.riskLevel) {
    changedFields.push("riskLevel");
  }

  if (!arraysEqual(data.missingDocs, readiness.missingDocs)) {
    changedFields.push("missingDocs");
  }

  return changedFields;
}

function emitDealsGetObservation(params: {
  governanceContext: GovernanceContext;
  user: {
    uid: string;
    email?: string | null;
    role?: string | null;
  };
  dealId: string;
  contractorId: string | null;
  eventType:
    | "deals_get_side_effect_recompute_observed"
    | "deals_get_stale_state_compensation_observed"
    | "deals_get_canonical_correction_observed"
    | "deals_get_noop_recompute_observed";
  changedFields: string[];
  latencyMs: number;
  isStale: boolean;
  readinessChanged: boolean;
}) {
  const comparisonFields = ["readinessScore", "riskLevel", "missingDocs"];
  const divergenceClassification =
    params.readinessChanged
      ? DIVERGENCE_CLASSIFICATIONS.STALE_STATE_COMPENSATION
      : DIVERGENCE_CLASSIFICATIONS.LEGACY_CANONICAL_STATUS_MATCH;

  emitGovernanceEvent({
    eventId: crypto.randomUUID(),
    eventVersion: "v1",
    occurredAt: new Date().toISOString(),
    category:
      params.eventType === "deals_get_side_effect_recompute_observed"
        ? "legacy_mutation"
        : "divergence_observation",
    eventType: params.eventType,
    correlation: {
      correlationId: params.governanceContext.correlationId,
      requestId: params.governanceContext.requestId,
    },
    actor: {
      actorId: params.user.uid,
      actorEmail: params.user.email?.trim() || null,
      actorRole: params.user.role ?? null,
    },
    source: {
      sourceType: "route",
      sourceName: params.governanceContext.route.sourceName,
      routePath: params.governanceContext.route.routePath ?? null,
      method: params.governanceContext.route.method ?? "GET",
      sourceClassification: params.governanceContext.route.sourceClassification ?? null,
    },
    entity: {
      entityType: "deal",
      entityId: params.dealId,
      contractorId: params.contractorId,
    },
    mutation: {
      mutationType: MUTATION_CLASSIFICATIONS.LEGACY_GET_SIDE_EFFECT_WRITE,
      mutatedFields: params.changedFields,
    },
  governance: {
      routeClassification: ROUTE_CLASSIFICATIONS.LEGACY,
      sourceClassification: params.governanceContext.route.sourceClassification ?? ROUTE_CLASSIFICATIONS.LEGACY,
      authorityClassification: AUTHORITY_CLASSIFICATIONS.DERIVED_WRITER,
      latencyMs: params.latencyMs,
      failOpen: true,
    },
    comparison: {
      comparedFields: comparisonFields,
      divergenceFields: params.changedFields,
      divergenceClassification,
      staleStateDetected: params.isStale,
      changedState: params.readinessChanged,
    },
  });
}

export const GET = withGovernanceObservation(
  {
    sourceName: "deals_get",
    routePath: "/api/deals",
    method: "GET",
    sourceType: "route",
    sourceClassification: ROUTE_CLASSIFICATIONS.LEGACY,
  },
  async (req: NextRequest, _context: unknown, governanceContext) => {
  try {
    const user = await requireAuthorizedUser(req);

    let snapshot;

    if (isPrivilegedRole(user.role)) {
      snapshot = await db.collection("deals").get();
    } else if (user.role === "contractor" && user.contractorId) {
      snapshot = await db
        .collection("deals")
        .where("contractorId", "==", user.contractorId)
        .get();
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deals = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const observationStartedAt = Date.now();
        const data = doc.data();
        const readiness = calculateReadiness(
          (data.contractorDocs as Record<string, boolean> | undefined) || {}
        );
        const suggestions = generateFixSuggestions({
          ...data,
          ...readiness,
        });
        const changedFields = getChangedReadinessFields(data, readiness);
        const readinessChanged = changedFields.length > 0;
        const isStale =
          typeof data.aiInsightsUpdatedAt !== "number" ||
          Date.now() - data.aiInsightsUpdatedAt > AI_INSIGHTS_TTL_MS;
        const contractorId =
          typeof data.contractorId === "string" && data.contractorId.trim().length > 0
            ? data.contractorId.trim()
            : null;

        let aiInsights =
          typeof data.aiInsights === "string" && data.aiInsights.trim().length > 0
            ? data.aiInsights
            : null;

        const contractorResolution = contractorId
          ? await resolveContractorReference({
              reference: contractorId,
              actor: user,
              expectedWorkspaceId: typeof data.workspaceId === "string" ? data.workspaceId : null,
              dealId: doc.id,
              logContext: "api.deals.list",
            })
          : null;
        const resolvedContractor = contractorResolution?.ok === true ? contractorResolution.contractor : null;
        const canonicalContractorId = contractorResolution?.ok === true ? contractorResolution.contractorId : contractorId;
        const resolvedContractorName = resolvedContractor
          ? getContractorBusinessName(resolvedContractor)
          : getString(data.contractorName) || getString(data.companyName) || null;

        const shouldGenerateAI = !aiInsights || isStale || readinessChanged;

        if (shouldGenerateAI) {
          try {
            aiInsights = await generateAIInsights({
              ...data,
              ...readiness,
            });

            await db.collection("deals").doc(doc.id).update({
              aiInsights,
              aiInsightsUpdatedAt: Date.now(),
              readinessScore: readiness.readinessScore,
              riskLevel: readiness.riskLevel,
              missingDocs: readiness.missingDocs,
            });

            if (readinessChanged) {
              emitDealsGetObservation({
                governanceContext,
                user,
                dealId: doc.id,
                contractorId,
                eventType: "deals_get_side_effect_recompute_observed",
                changedFields,
                latencyMs: Date.now() - observationStartedAt,
                isStale,
                readinessChanged,
              });

              emitDealsGetObservation({
                governanceContext,
                user,
                dealId: doc.id,
                contractorId,
                eventType: "deals_get_stale_state_compensation_observed",
                changedFields,
                latencyMs: Date.now() - observationStartedAt,
                isStale,
                readinessChanged,
              });

              emitDealsGetObservation({
                governanceContext,
                user,
                dealId: doc.id,
                contractorId,
                eventType: "deals_get_canonical_correction_observed",
                changedFields,
                latencyMs: Date.now() - observationStartedAt,
                isStale,
                readinessChanged,
              });
            } else {
              emitDealsGetObservation({
                governanceContext,
                user,
                dealId: doc.id,
                contractorId,
                eventType: "deals_get_noop_recompute_observed",
                changedFields,
                latencyMs: Date.now() - observationStartedAt,
                isStale,
                readinessChanged,
              });
            }
          } catch (err) {
            console.error("AI generation failed:", err);
            aiInsights = aiInsights || null;
          }
        } else if (readinessChanged) {
          await db.collection("deals").doc(doc.id).update({
            readinessScore: readiness.readinessScore,
            riskLevel: readiness.riskLevel,
            missingDocs: readiness.missingDocs,
          });

          emitDealsGetObservation({
            governanceContext,
            user,
            dealId: doc.id,
            contractorId,
            eventType: "deals_get_side_effect_recompute_observed",
            changedFields,
            latencyMs: Date.now() - observationStartedAt,
            isStale,
            readinessChanged,
          });

          emitDealsGetObservation({
            governanceContext,
            user,
            dealId: doc.id,
            contractorId,
            eventType: "deals_get_stale_state_compensation_observed",
            changedFields,
            latencyMs: Date.now() - observationStartedAt,
            isStale,
            readinessChanged,
          });

          emitDealsGetObservation({
            governanceContext,
            user,
            dealId: doc.id,
            contractorId,
            eventType: "deals_get_canonical_correction_observed",
            changedFields,
            latencyMs: Date.now() - observationStartedAt,
            isStale,
            readinessChanged,
          });
        } else {
          emitDealsGetObservation({
            governanceContext,
            user,
            dealId: doc.id,
            contractorId,
            eventType: "deals_get_noop_recompute_observed",
            changedFields,
            latencyMs: Date.now() - observationStartedAt,
            isStale,
            readinessChanged,
          });
        }

        // FUTURE: enforce readiness-based restrictions here
        // if (role === "contractor" && readiness.readinessScore < 60) {
        //   block action
        // }
        return {
          id: doc.id,
          ...data,
          contractorId: canonicalContractorId ?? undefined,
          contractorName: resolvedContractorName ?? undefined,
          storedContractorReference: contractorId,
          contractorReferenceResolution: contractorResolution
            ? contractorResolution.ok === true
              ? {
                  status: "resolved",
                  referenceType: contractorResolution.referenceType,
                  contractorId: contractorResolution.contractorId,
                }
              : {
                  status: "unresolved",
                  failureReason: contractorResolution.failureReason,
                }
            : null,
          ...readiness,
          suggestions,
          aiInsights: aiInsights || null,
        };
      })
    );

    return NextResponse.json({ deals }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("DEALS API ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch deals" },
      { status: 500 }
    );
  }
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    if (!isPrivilegedRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const contractorId = getString(body.contractorId);
    const title = getString(body.title);
    const tenderText = getString(body.tenderText);
    const value = getNumber(body.value);

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    if (!contractorId) {
      return NextResponse.json(
        { error: "Deal must be linked to a contractor" },
        { status: 400 }
      );
    }

    const contractorResolution = await resolveContractorReference({
      reference: contractorId,
      actor: user,
      logContext: "api.deals.create",
    });

    if (contractorResolution.ok === false) {
      return NextResponse.json(
        { error: "Invalid contractorId", reason: contractorResolution.failureReason },
        { status: 400 }
      );
    }

    const contractor = contractorResolution.contractor;
    const canonicalContractorId = contractorResolution.contractorId;
    const createdAt = new Date().toISOString();
    const newDeal = {
      contractorId: canonicalContractorId,
      storedContractorReference: contractorId,
      contractorName:
        getContractorBusinessName(contractor) ||
        canonicalContractorId,
      title,
      name: title,
      status: "NEW",
      value,
      createdAt,
      updatedAt: createdAt,
      analysis: {
        requirements: {} as Record<string, boolean>,
        missing: [] as string[],
        score: 0,
        risk: "UNKNOWN",
      },
    };

    const docRef = await db.collection("deals").add(newDeal);

    if (tenderText) {
      const analysis = analyzeTenderText(tenderText);

      await docRef.update({
        analysis,
      });

      newDeal.analysis = analysis;
    }

    return NextResponse.json(
      {
        id: docRef.id,
        ...newDeal,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(" DEAL CREATE ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to create deal",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
