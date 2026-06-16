export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import {
  getLatestVehicleFinanceIdentityIntelligenceJobForDocument,
  getVehicleFinanceIdentityIntelligenceDocument,
  getVehicleFinanceIdentityIntelligenceJobStatus,
  processVehicleFinanceIdentityIntelligenceJob,
} from "@/lib/vehicle-finance/intelligence/identityIntelligenceJobs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function buildResponse(applicationId: string, documentId: string) {
  const job = await getLatestVehicleFinanceIdentityIntelligenceJobForDocument(documentId);
  if (!job) {
    return NextResponse.json({ error: "Identity intelligence job not found" }, { status: 404 });
  }

  if (job.status === "QUEUED" || job.status === "PROCESSING") {
    void processVehicleFinanceIdentityIntelligenceJob(job.jobId);
  }

  const document = await getVehicleFinanceIdentityIntelligenceDocument(job.documentId);
  if (!document || document.applicationId !== applicationId) {
    return NextResponse.json({ error: "Identity intelligence job not found" }, { status: 404 });
  }

  const identityIntelligence = document.aiAnalysis && typeof document.aiAnalysis === "object"
    ? (document.aiAnalysis as Record<string, unknown>).identityIntelligence ?? null
    : null;

  return NextResponse.json({
    job,
    document,
    identityIntelligence,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string; documentId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const { applicationId, documentId } = await context.params;
    const normalizedApplicationId = applicationId.trim();
    const normalizedDocumentId = documentId.trim();
    if (!normalizedApplicationId || !normalizedDocumentId) {
      return NextResponse.json({ error: "Missing applicationId or documentId" }, { status: 400 });
    }

    const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || null;
    if (jobId) {
      const job = await getVehicleFinanceIdentityIntelligenceJobStatus(jobId);
      if (!job) {
        return NextResponse.json({ error: "Identity intelligence job not found" }, { status: 404 });
      }

      if (job.status === "QUEUED" || job.status === "PROCESSING") {
        void processVehicleFinanceIdentityIntelligenceJob(job.jobId);
      }

      const document = await getVehicleFinanceIdentityIntelligenceDocument(job.documentId);
      if (!document || document.applicationId !== normalizedApplicationId) {
        return NextResponse.json({ error: "Identity intelligence job not found" }, { status: 404 });
      }
      const identityIntelligence = document.aiAnalysis && typeof document.aiAnalysis === "object"
        ? (document.aiAnalysis as Record<string, unknown>).identityIntelligence ?? null
        : null;

      return NextResponse.json({
        job,
        document,
        identityIntelligence,
      });
    }

    return buildResponse(normalizedApplicationId, normalizedDocumentId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[vehicle-finance] identity intelligence status failed", error);
    return jsonError("Vehicle finance identity intelligence status failed", 500);
  }
}
