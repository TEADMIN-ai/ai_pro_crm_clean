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
import {
  getLatestVehicleFinanceBankStatementIntelligenceJobForDocument,
  getVehicleFinanceBankStatementIntelligenceDocument,
  getVehicleFinanceBankStatementIntelligenceJobStatus,
  processVehicleFinanceBankStatementIntelligenceJob,
} from "@/lib/vehicle-finance/intelligence/bankStatementIntelligenceJobs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function resolveIntelligenceContext(documentId: string, jobId?: string | null) {
  const driverJob = jobId ? null : await getLatestVehicleFinanceDriverLicenceIntelligenceJobForDocument(documentId);
  const payslipJob = driverJob || jobId ? null : await getLatestVehicleFinancePayslipIntelligenceJobForDocument(documentId);
  const bankStatementJob = driverJob || payslipJob || jobId ? null : await getLatestVehicleFinanceBankStatementIntelligenceJobForDocument(documentId);
  const job = driverJob ?? payslipJob ?? bankStatementJob;
  return { driverJob, payslipJob, bankStatementJob, job };
}

async function resolveIntelligenceContextByJobId(jobId: string) {
  const driverJob = await getVehicleFinanceDriverLicenceIntelligenceJobStatus(jobId);
  const payslipJob = driverJob ? null : await getVehicleFinancePayslipIntelligenceJobStatus(jobId);
  const bankStatementJob = driverJob || payslipJob ? null : await getVehicleFinanceBankStatementIntelligenceJobStatus(jobId);
  const job = driverJob ?? payslipJob ?? bankStatementJob;
  return { driverJob, payslipJob, bankStatementJob, job };
}

function getIntelligenceKey(driverJob: boolean, payslipJob: boolean, bankStatementJob: boolean) {
  if (driverJob) return "driverLicenceIntelligence";
  if (payslipJob) return "payslipIntelligence";
  if (bankStatementJob) return "bankStatementIntelligence";
  return null;
}

async function buildResponse(applicationId: string, documentId: string) {
  const { driverJob, payslipJob, bankStatementJob, job } = await resolveIntelligenceContext(documentId);
  if (!job) {
    return NextResponse.json({ error: "Vehicle finance intelligence job not found" }, { status: 404 });
  }

  if (job.status === "QUEUED" || job.status === "PROCESSING") {
    void (
      driverJob
        ? processVehicleFinanceDriverLicenceIntelligenceJob(job.jobId)
        : payslipJob
          ? processVehicleFinancePayslipIntelligenceJob(job.jobId)
          : processVehicleFinanceBankStatementIntelligenceJob(job.jobId)
    );
  }

  const document = driverJob
    ? await getVehicleFinanceDriverLicenceIntelligenceDocument(job.documentId)
    : payslipJob
      ? await getVehicleFinancePayslipIntelligenceDocument(job.documentId)
      : await getVehicleFinanceBankStatementIntelligenceDocument(job.documentId);
  if (!document || document.applicationId !== applicationId) {
    return NextResponse.json({ error: "Vehicle finance intelligence job not found" }, { status: 404 });
  }

  const intelligence = document?.aiAnalysis && typeof document.aiAnalysis === "object"
    ? driverJob
      ? (document.aiAnalysis as Record<string, unknown>).driverLicenceIntelligence ?? null
      : payslipJob
        ? (document.aiAnalysis as Record<string, unknown>).payslipIntelligence ?? null
        : (document.aiAnalysis as Record<string, unknown>).bankStatementIntelligence ?? null
    : null;

  return NextResponse.json({
    job,
    document,
    ...(driverJob
      ? { driverLicenceIntelligence: intelligence }
      : payslipJob
        ? { payslipIntelligence: intelligence }
        : { bankStatementIntelligence: intelligence }),
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
      const { driverJob, payslipJob, bankStatementJob, job } = await resolveIntelligenceContextByJobId(jobId);
      if (!job) {
        return NextResponse.json({ error: "Vehicle finance intelligence job not found" }, { status: 404 });
      }

      if (job.status === "QUEUED" || job.status === "PROCESSING") {
        void (
          driverJob
            ? processVehicleFinanceDriverLicenceIntelligenceJob(job.jobId)
            : payslipJob
              ? processVehicleFinancePayslipIntelligenceJob(job.jobId)
              : processVehicleFinanceBankStatementIntelligenceJob(job.jobId)
        );
      }

      const document = driverJob
        ? await getVehicleFinanceDriverLicenceIntelligenceDocument(job.documentId)
        : payslipJob
          ? await getVehicleFinancePayslipIntelligenceDocument(job.documentId)
          : await getVehicleFinanceBankStatementIntelligenceDocument(job.documentId);
      if (!document || document.applicationId !== normalizedApplicationId) {
        return NextResponse.json({ error: "Vehicle finance intelligence job not found" }, { status: 404 });
      }
      const intelligenceKey = getIntelligenceKey(Boolean(driverJob), Boolean(payslipJob), Boolean(bankStatementJob));
      const intelligence = document?.aiAnalysis && typeof document.aiAnalysis === "object" && intelligenceKey
        ? (document.aiAnalysis as Record<string, unknown>)[intelligenceKey] ?? null
        : null;

      return NextResponse.json({
        job,
        document,
        ...(driverJob
          ? { driverLicenceIntelligence: intelligence }
          : payslipJob
            ? { payslipIntelligence: intelligence }
            : { bankStatementIntelligence: intelligence }),
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
