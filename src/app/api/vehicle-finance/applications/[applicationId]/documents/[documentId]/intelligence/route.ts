export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import {
  getLatestVehicleFinanceDriverLicenceIntelligenceJobForDocument,
  getVehicleFinanceDriverLicenceIntelligenceDocument,
  getVehicleFinanceDriverLicenceIntelligenceJobStatus,
  processVehicleFinanceDriverLicenceIntelligenceJob,
} from "@/lib/vehicle-finance/intelligence/driverLicenceIntelligenceJobs";
import {
  getLatestVehicleFinancePayslipIntelligenceJobForDocument,
  getVehicleFinancePayslipIntelligenceDocument,
  getVehicleFinancePayslipIntelligenceJobStatus,
  processVehicleFinancePayslipIntelligenceJob,
} from "@/lib/vehicle-finance/intelligence/payslipIntelligenceJobs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function buildResponse(applicationId: string, documentId: string) {
  const driverJob = await getLatestVehicleFinanceDriverLicenceIntelligenceJobForDocument(documentId);
  const payslipJob = driverJob ? null : await getLatestVehicleFinancePayslipIntelligenceJobForDocument(documentId);
  const job = driverJob ?? payslipJob;
  if (!job) {
    return NextResponse.json({ error: "Driver licence intelligence job not found" }, { status: 404 });
  }

  if (job.status === "QUEUED" || job.status === "PROCESSING") {
    void (driverJob ? processVehicleFinanceDriverLicenceIntelligenceJob(job.jobId) : processVehicleFinancePayslipIntelligenceJob(job.jobId));
  }

  const document = driverJob
    ? await getVehicleFinanceDriverLicenceIntelligenceDocument(job.documentId)
    : await getVehicleFinancePayslipIntelligenceDocument(job.documentId);
  if (!document || document.applicationId !== applicationId) {
    return NextResponse.json({ error: "Driver licence intelligence job not found" }, { status: 404 });
  }

  const intelligence = document?.aiAnalysis && typeof document.aiAnalysis === "object"
    ? driverJob
      ? (document.aiAnalysis as Record<string, unknown>).driverLicenceIntelligence ?? null
      : (document.aiAnalysis as Record<string, unknown>).payslipIntelligence ?? null
    : null;

  return NextResponse.json({
    job,
    document,
    ...(driverJob ? { driverLicenceIntelligence: intelligence } : { payslipIntelligence: intelligence }),
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
      const driverJob = await getVehicleFinanceDriverLicenceIntelligenceJobStatus(jobId);
      const payslipJob = driverJob ? null : await getVehicleFinancePayslipIntelligenceJobStatus(jobId);
      const job = driverJob ?? payslipJob;
      if (!job) {
        return NextResponse.json({ error: "Driver licence intelligence job not found" }, { status: 404 });
      }

      if (job.status === "QUEUED" || job.status === "PROCESSING") {
        void (driverJob ? processVehicleFinanceDriverLicenceIntelligenceJob(job.jobId) : processVehicleFinancePayslipIntelligenceJob(job.jobId));
      }

      const document = driverJob
        ? await getVehicleFinanceDriverLicenceIntelligenceDocument(job.documentId)
        : await getVehicleFinancePayslipIntelligenceDocument(job.documentId);
      if (!document || document.applicationId !== normalizedApplicationId) {
        return NextResponse.json({ error: "Driver licence intelligence job not found" }, { status: 404 });
      }
      const driverLicenceIntelligence = document?.aiAnalysis && typeof document.aiAnalysis === "object"
        ? driverJob
          ? (document.aiAnalysis as Record<string, unknown>).driverLicenceIntelligence ?? null
          : (document.aiAnalysis as Record<string, unknown>).payslipIntelligence ?? null
        : null;

      return NextResponse.json({
        job,
        document,
        ...(driverJob ? { driverLicenceIntelligence } : { payslipIntelligence: driverLicenceIntelligence }),
      });
    }

    return buildResponse(normalizedApplicationId, normalizedDocumentId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[vehicle-finance] driver licence intelligence status failed", error);
    return jsonError("Vehicle finance driver licence intelligence status failed", 500);
  }
}
