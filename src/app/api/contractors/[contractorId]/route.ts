import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity/logActivity";
import { AuthorizationError, assertCanAccessContractor, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { listContractorDocuments, resolveContractorForAccess, updateContractorById } from "@/server/services/contractorService";

const SAFE_CONTRACTOR_PATCH_FIELDS = new Set([
  "contactPerson",
  "phone",
  "contactPhone",
  "address",
  "physicalAddress",
  "serviceCategories",
  "serviceAreas",
  "regions",
  "provinces",
  "operationalNotes",
  "notes",
  "website",
  "profileSummary",
]);

const PROTECTED_CONTRACTOR_PATCH_FIELDS = new Set([
  "id",
  "uid",
  "authUid",
  "workspace",
  "workspaceId",
  "workspaceSlug",
  "contractorId",
  "userId",
  "linkedUserId",
  "ownerId",
  "createdBy",
  "createdByEmail",
  "createdByRole",
  "createdAt",
  "legalName",
  "businessName",
  "registeredBusinessName",
  "companyName",
  "company",
  "name",
  "displayName",
  "tradingName",
  "registrationNumber",
  "companyRegistrationNumber",
  "identityResolved",
  "identityStatus",
  "identityResolutionStatus",
  "identityMatchStatus",
  "identityResolution",
  "manuallyResolved",
  "canonicalBusinessIdentity",
  "verifiedIdentity",
  "businessIdentityEvidenceStatus",
  "complianceScore",
  "complianceStatus",
  "complianceStatusScore",
  "complianceDecisionStatus",
  "complianceApproved",
  "readinessScore",
  "readinessStatus",
  "readinessDecisionStatus",
  "overallStatus",
  "requiredDocuments",
  "missingDocuments",
  "missingDocs",
  "docsMissing",
  "documentSummary",
  "documentCompletenessScore",
  "documentReviewStatus",
  "requiredDocsApprovedCount",
  "requiredDocsTotalCount",
  "reviewRequiredCount",
  "blockingReasons",
  "blockers",
  "recommendation",
  "assignmentAllowed",
  "assignmentStatus",
  "assignmentSummary",
  "tenderLockStatus",
  "isTenderLocked",
  "sarsTcsSummary",
  "taxPinStatus",
  "taxValid",
  "taxVerified",
  "taxCompliant",
  "taxReferenceNumber",
  "csdStatus",
  "csdValidationStatus",
  "csdNumber",
  "csdMNumber",
  "mNumber",
  "csdValid",
  "externalVerificationStatus",
  "approvalStatus",
  "approvedBy",
  "approvedByUid",
  "approvedByName",
  "approvedAt",
  "reviewedBy",
  "reviewedAt",
  "rejectedBy",
  "rejectedAt",
  "rejectionReason",
  "auditTrail",
  "governance",
  "governanceState",
  "migrationState",
  "logicVersion",
  "decisionLogicVersion",
  "version",
  "updatedAt",
  "updatedBy",
  "updatedByEmail",
  "updatedByRole",
  "metadata",
]);

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getContractorWorkspaceId(contractor: Record<string, unknown>): string | null {
  const workspace = contractor.workspace && typeof contractor.workspace === "object"
    ? (contractor.workspace as Record<string, unknown>)
    : null;
  return getString(contractor.workspaceId) ?? getString(workspace?.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildSafePatch(body: Record<string, unknown>): { ok: true; updates: Record<string, unknown> } | { ok: false; status: number; error: string; fields: string[] } {
  const fields = Object.keys(body);
  const protectedFields = fields.filter((field) => PROTECTED_CONTRACTOR_PATCH_FIELDS.has(field));
  if (protectedFields.length > 0) {
    return { ok: false, status: 400, error: "Protected contractor fields cannot be updated through this route", fields: protectedFields };
  }

  const unknownFields = fields.filter((field) => !SAFE_CONTRACTOR_PATCH_FIELDS.has(field));
  if (unknownFields.length > 0) {
    return { ok: false, status: 400, error: "Unsupported contractor update fields", fields: unknownFields };
  }

  const updates: Record<string, unknown> = {};
  for (const field of fields) {
    updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, status: 400, error: "No supported contractor update fields provided", fields: [] };
  }

  return { ok: true, updates };
}
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(req);
    const { contractorId } = await params;

    if (!contractorId) {
      return NextResponse.json({ success: false, error: "Missing contractorId" }, { status: 400 });
    }

    const resolved = await resolveContractorForAccess({
      contractorReference: contractorId,
      actor: user,
      logContext: "api.contractors.detail",
    });

    if (resolved.ok === false) {
      const status = resolved.failureReason === "unauthorized_contractor" || resolved.failureReason === "cross_workspace" ? 403 : 404;
      return NextResponse.json({ success: false, error: "Contractor not found", reason: resolved.failureReason }, { status });
    }

    assertCanAccessContractor(user, resolved.contractorId);

    const documentRecords = await listContractorDocuments(resolved.contractorId);

    return NextResponse.json({
      success: true,
      ...resolved.contractor,
      id: resolved.contractorId,
      contractorId: resolved.contractorId,
      storedContractorReference: resolved.storedReference,
      contractorReferenceType: resolved.referenceType,
      documentRecords,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("GET Contractor Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(req);
    const { contractorId } = await params;
    const body = await req.json();

    if (!contractorId) {
      return NextResponse.json({ success: false, error: "Missing contractorId" }, { status: 400 });
    }

    if (!isRecord(body)) {
      return NextResponse.json({ success: false, error: "Contractor update body must be an object" }, { status: 400 });
    }

    if (!isPrivilegedRole(user.role)) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 403 });
    }

    const actorWorkspaceId = getString(user.workspaceId);
    if (!actorWorkspaceId) {
      return NextResponse.json({ success: false, error: "Workspace context is required" }, { status: 403 });
    }

    const resolved = await resolveContractorForAccess({
      contractorReference: contractorId,
      actor: user,
      expectedWorkspaceId: actorWorkspaceId,
      logContext: "api.contractors.patch",
    });

    if (resolved.ok === false) {
      const status = resolved.failureReason === "cross_workspace" || resolved.failureReason === "unauthorized_contractor" ? 403 : 404;
      return NextResponse.json({ success: false, error: "Contractor not found", reason: resolved.failureReason }, { status });
    }

    const contractorWorkspaceId = getContractorWorkspaceId(resolved.contractor);
    if (!contractorWorkspaceId) {
      return NextResponse.json({ success: false, error: "Contractor workspace is unresolved" }, { status: 403 });
    }

    if (contractorWorkspaceId !== actorWorkspaceId) {
      return NextResponse.json({ success: false, error: "Cross-workspace contractor update rejected" }, { status: 403 });
    }

    const safePatch = buildSafePatch(body);
    if (safePatch.ok === false) {
      return NextResponse.json(
        { success: false, error: safePatch.error, fields: safePatch.fields },
        { status: safePatch.status },
      );
    }

    await updateContractorById(resolved.contractorId, safePatch.updates);
    await logActivity({
      contractorId: resolved.contractorId,
      action: "Contractor updated",
      performedBy: user.email?.trim() || user.uid,
    });

    return NextResponse.json({ success: true, message: "Contractor updated successfully" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("PATCH Contractor Error:", error);
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: "Hard deletion is disabled. Use contractor archive instead." }, { status: 405 });
}
