export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { generateFixSuggestions } from "@/lib/engine/fixSuggestions";
import { analyzeTenderText } from "@/lib/tenderAnalysisService";
import { getContractorBusinessName, resolveContractorReference } from "@/lib/contractors/contractorReferenceResolver";
import { getDealContractorReference } from "@/lib/deals/contractorReference";
import { buildOpportunityExecutionState } from "@/lib/opportunities/opportunityExecution";
import { buildProcurementExecutionProjection } from "@/lib/opportunities/procurementExecutionProjection";

const db = getFirebaseAdmin();

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

type StoredReadinessProjection = {
  source: "stored_snapshot";
  status: "UNKNOWN" | "BLOCKED" | "STALE";
  readinessScore: number | null;
  riskLevel: string | null;
  missingDocs: string[];
  stale: true;
  staleReasons: string[];
  assignmentAllowed: false;
  eligible: false;
  blockingReasons: string[];
};

function buildStoredReadinessProjection(data: Record<string, unknown>): StoredReadinessProjection {
  const storedScore = typeof data.readinessScore === "number" && Number.isFinite(data.readinessScore)
    ? data.readinessScore
    : null;
  const missingDocs = getStringArray(data.missingDocs);
  const staleReasons: string[] = [];

  if (storedScore === null) {
    staleReasons.push("No canonical readiness snapshot is available for this deal.");
  }

  if (missingDocs.length > 0) {
    staleReasons.push("Required document evidence is incomplete.");
  }

  if (!getString(data.readinessUpdatedAt) && !getString(data.assignmentDecisionEvaluatedAt)) {
    staleReasons.push("Readiness has not been refreshed by an explicit authorised workflow.");
  }

  if (!getString(data.assignmentDecisionLogicVersion) && !getString(data.readinessLogicVersion)) {
    staleReasons.push("No canonical decision logic version is attached to this snapshot.");
  }

  const status: StoredReadinessProjection["status"] =
    storedScore === null ? "UNKNOWN" : missingDocs.length > 0 ? "BLOCKED" : "STALE";

  const blockingReasons = staleReasons.length > 0
    ? staleReasons
    : ["GET /api/deals does not authorise assignment or repair readiness state."];

  return {
    source: "stored_snapshot",
    status,
    readinessScore: status === "STALE" && staleReasons.length === 0 ? storedScore : null,
    riskLevel: getString(data.riskLevel) || null,
    missingDocs,
    stale: true,
    staleReasons: blockingReasons,
    assignmentAllowed: false,
    eligible: false,
    blockingReasons,
  };
}

function buildWorkflowPhaseProjection(input: {
  id: string;
  data: Record<string, unknown>;
  contractor: Record<string, unknown> | null;
  contractorId: string | null;
  contractorName: string | null;
}): string {
  try {
    const deal = {
      id: input.id,
      ...input.data,
      contractorId: input.contractorId ?? undefined,
      contractorName: input.contractorName ?? undefined,
    };
    const state = buildOpportunityExecutionState({ deal, contractor: input.contractor });
    const projection = buildProcurementExecutionProjection({
      deal,
      state,
      remediationRequests: state.remediationRequests,
    });

    return projection.currentPhase;
  } catch (error) {
    console.error("DEALS WORKFLOW PHASE PROJECTION ERROR:", error);
    return "UNKNOWN";
  }
}
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    let snapshot;
    if (user.role === "contractor") {
      if (!user.contractorId) {
        return NextResponse.json({ error: "Contractor profile required" }, { status: 403 });
      }
      snapshot = await db.collection("deals").where("contractorId", "==", user.contractorId).get();
    } else if (isPrivilegedRole(user.role)) {
      snapshot = await db.collection("deals").get();
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deals = await Promise.all(
      snapshot.docs.map(async (doc: { id: string; data: () => Record<string, unknown> }) => {
        const data = doc.data();
        const description = getString(data.description);
        const title = getString(data.title);
        const scopeText = getString(data.scopeOfWork);
        const combinedTenderText = [title, description, scopeText].filter(Boolean).join("\n\n");
        const tenderAnalysis = analyzeTenderText(combinedTenderText);
        const readinessProjection = buildStoredReadinessProjection(data);
        const suggestions = readinessProjection.missingDocs.length > 0
          ? generateFixSuggestions({
              id: doc.id,
              title,
              missingDocs: readinessProjection.missingDocs,
              readinessScore: readinessProjection.readinessScore ?? 0,
              riskLevel: readinessProjection.riskLevel ?? "unknown",
            })
          : [];
        const storedAiInsights = getString(data.aiInsights) || null;
        const contractorReference = getDealContractorReference(data);
        const contractorId = contractorReference.status === "reference_present" ? contractorReference.value : null;
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
        const canonicalContractorId = contractorResolution?.ok === true ? contractorResolution.contractorId : null;
        const resolvedContractorName = resolvedContractor ? getContractorBusinessName(resolvedContractor) : null;
        const resolvedCompanyId = getString(data.companyId) || null;
        const workflowPhase = buildWorkflowPhaseProjection({
          id: doc.id,
          data,
          contractor: resolvedContractor,
          contractorId: canonicalContractorId,
          contractorName: resolvedContractorName,
        });

        return {
          id: doc.id,
          ...data,
          legacyStatus: getString(data.status) || null,
          workflowPhase,
          title,
          description,
          scopeOfWork: scopeText,
          contractorId: canonicalContractorId ?? undefined,
          contractorName: resolvedContractorName ?? undefined,
          companyId: resolvedCompanyId,
          storedContractorReference: contractorId,
          contractorReference: contractorReference.status === "reference_present"
            ? { status: "reference_present", field: contractorReference.field, value: contractorReference.value }
            : { status: "no_reference" },
          contractorReferenceResolution: contractorReference.status === "no_reference"
            ? { status: "none" }
            : contractorResolution?.ok === true
              ? {
                  status: "resolved",
                  referenceField: contractorReference.field,
                  referenceType: contractorResolution.referenceType,
                  contractorId: contractorResolution.contractorId,
                }
              : {
                  status: "unresolved",
                  referenceField: contractorReference.field,
                  failureReason: contractorResolution?.failureReason ?? "not_found",
                },
          readinessScore: readinessProjection.readinessScore,
          riskLevel: readinessProjection.riskLevel,
          missingDocs: readinessProjection.missingDocs,
          readinessProjection,
          aiInsights: storedAiInsights,
          aiInsightsStatus: storedAiInsights ? "stored_snapshot" : "unavailable",
          suggestions,
          tenderAnalysis,
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
}

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
