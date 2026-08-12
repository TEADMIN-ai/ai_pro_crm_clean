import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  AuthorizationError,
  assertCanAccessContractor,
  isPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { listDealsForUser } from "@/server/services/dealService";
import {
  getLatestContractorAcknowledgement,
  getLatestValidContractorSignature,
} from "@/server/services/contractorAcknowledgementService";
import { listContractorDocuments, resolveContractorForAccess } from "@/server/services/contractorService";
import { buildContractorOnboardingDecisionView } from "@/lib/contractors/contractorOnboardingDecisionView";
import { isStagingSimulationAllowed, STAGING_SIMULATION_MESSAGE } from "@/lib/server/stagingSimulationSafety";
import {
  buildContractorOperationalTimeline,
  buildLastAction,
  listContractorCommandNotes,
} from "@/server/services/contractorCommandCenterService";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const parsed = value.toDate() as Date;
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function containsContractorReference(value: unknown, contractorId: string): boolean {
  if (typeof value === "string") return value === contractorId || value === `contractors/${contractorId}`;
  if (Array.isArray(value)) return value.some((item) => containsContractorReference(item, contractorId));
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some((item) => containsContractorReference(item, contractorId));
  return false;
}

function normalizeVisibleNote(id: string, data: Record<string, unknown>, contractorRole: boolean) {
  const contractorVisible = data.contractorVisible === true;
  if (contractorRole && !contractorVisible) {
    return null;
  }

  const note = asString(data.note) ?? asString(data.message) ?? asString(data.text);
  if (!note) {
    return null;
  }

  return {
    id,
    note,
    contractorVisible,
    createdBy: asString(data.createdBy),
    createdAt: toIsoDate(data.createdAt),
  };
}


async function listContractorNotes(contractorId: string, contractorRole: boolean) {
  const snapshot = await getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("notes")
    .get();

  return snapshot.docs
    .map((doc) => normalizeVisibleNote(doc.id, (doc.data() ?? {}) as Record<string, unknown>, contractorRole))
    .filter((note): note is NonNullable<typeof note> => Boolean(note))
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
      return rightTime - leftTime;
    });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    const resolved = await resolveContractorForAccess({
      contractorReference: contractorId,
      actor: user,
      logContext: "api.contractors.onboarding",
    });

    if (resolved.ok === false) {
      const status = resolved.failureReason === "unauthorized_contractor" || resolved.failureReason === "cross_workspace" ? 403 : 404;
      return jsonError("Contractor not found", status);
    }

    assertCanAccessContractor(user, resolved.contractorId);

    const canonicalContractorId = resolved.contractorId;
    const contractor = resolved.contractor;

    const contractorRole = user.role === "contractor";
    const [documents, deals, notes, commandNotes, timeline, acknowledgement, signaturePayload] = await Promise.all([
      listContractorDocuments(canonicalContractorId),
      listDealsForUser(user),
      listContractorNotes(canonicalContractorId, contractorRole),
      contractorRole ? Promise.resolve([]) : listContractorCommandNotes(canonicalContractorId),
      contractorRole ? Promise.resolve([]) : buildContractorOperationalTimeline(canonicalContractorId),
      getLatestContractorAcknowledgement(canonicalContractorId),
      getLatestValidContractorSignature(canonicalContractorId),
    ]);
    const canonicalDecision = buildContractorOnboardingDecisionView({ contractor, documents });
    const lastAction = contractorRole ? null : buildLastAction(timeline);

    const historicalDealCount = deals.filter((deal) => containsContractorReference(deal, canonicalContractorId)).length;
    const linkedDeals = deals
      .filter((deal) => deal.contractorId === canonicalContractorId)
      .map((deal) => ({
        id: deal.id,
        title: deal.title,
        stage: deal.stage,
        status: deal.status,
        tenderLockStatus: deal.tenderLockStatus,
        readinessScore: deal.readinessScore,
        riskLevel: deal.riskLevel,
        updatedAt: toIsoDate(deal.updatedAt),
        tenderAnalysis: deal.tenderAnalysis ?? null,
        contractorTenderSummary:
          deal.contractorTenderSummary && typeof deal.contractorTenderSummary === "object"
            ? deal.contractorTenderSummary
            : null,
      }));

    return NextResponse.json(
      {
        contractor: {
          ...contractor,
          id: canonicalContractorId,
          contractorId: canonicalContractorId,
          storedContractorReference: resolved.storedReference,
          contractorReferenceType: resolved.referenceType,
        },
        documents,
        canonicalDecision,
        notes,
        commandNotes,
        timeline,
        lastAction,
        linkedDeals,
        historicalDealCount,
        acknowledgement,
        signaturePayload,
        stagingSimulation: {
          available: isPrivilegedRole(user.role) && isStagingSimulationAllowed(),
          message: STAGING_SIMULATION_MESSAGE,
        },
        viewer: {
          role: user.role,
          contractorId: user.contractorId ?? null,
          isPrivileged: isPrivilegedRole(user.role),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("CONTRACTOR ONBOARDING FETCH ERROR:", error);
    return jsonError("Failed to fetch contractor onboarding", 500);
  }
}
