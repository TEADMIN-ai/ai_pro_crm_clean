export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinanceStaffRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import {
  getLatestVehicleFinanceTrainingValidationJobForDocument,
  getVehicleFinanceTrainingDocumentById,
  getVehicleFinanceTrainingResultByDocumentId,
  getVehicleFinanceTrainingValidationJobStatus,
  processVehicleFinanceTrainingValidationJob,
  queueVehicleFinanceTrainingValidation,
} from "@/lib/vehicle-finance/training";

async function buildJobResponse(documentId: string) {
  const job = await getLatestVehicleFinanceTrainingValidationJobForDocument(documentId);
  if (!job) {
    return NextResponse.json({ error: "Training validation job not found" }, { status: 404 });
  }

  if (job.status === "QUEUED" || job.status === "PROCESSING") {
    void processVehicleFinanceTrainingValidationJob(job.jobId);
  }

  const result = job.status === "PROCESSED" ? await getVehicleFinanceTrainingResultByDocumentId(job.documentId) : null;
  const metrics = result
    ? {
        pdfTextLength: result.pdfTextLength ?? 0,
        openAiTextLength: result.openAiOcrTextLength ?? 0,
        tesseractTextLength: result.tesseractOcrTextLength ?? 0,
        finalTextLength: result.extractedTextLength,
        confidenceScore: result.confidenceScore,
      }
    : null;

  return NextResponse.json({
    job,
    status: job.status,
    result,
    metrics,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceStaffRole(user);

    const { documentId } = await context.params;
    const normalizedDocumentId = documentId.trim();
    if (!normalizedDocumentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const document = await getVehicleFinanceTrainingDocumentById(normalizedDocumentId);
    console.log("[vehicle-finance-training] validationStarted", {
      documentId: normalizedDocumentId,
      documentsFound: document ? 1 : 0,
      documentCategory: document?.category ?? null,
    });

    if (!document) {
      console.log("[vehicle-finance-training] validationFailed", {
        documentId: normalizedDocumentId,
        documentCategory: null,
        reason: "document_not_found",
      });
      return NextResponse.json({ error: "Training document not found" }, { status: 404 });
    }

    const job = await queueVehicleFinanceTrainingValidation(normalizedDocumentId);

    if (!job) {
      return NextResponse.json({ error: "Training validation could not be queued" }, { status: 500 });
    }

    console.log("[vehicle-finance-training] validationCompleted", {
      documentId: normalizedDocumentId,
      documentCategory: document.category,
      jobId: job.jobId,
      status: job.status,
    });

    return NextResponse.json(
      {
        jobId: job.jobId,
        documentId: normalizedDocumentId,
        status: job.status,
        message: "Validation queued.",
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance-training] document validation failed", error);
    return NextResponse.json({ error: "Vehicle finance training validation failed" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceStaffRole(user);

    const { documentId } = await context.params;
    const normalizedDocumentId = documentId.trim();
    if (!normalizedDocumentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || null;
    if (jobId) {
      const job = await getVehicleFinanceTrainingValidationJobStatus(jobId);
      if (!job) {
        return NextResponse.json({ error: "Training validation job not found" }, { status: 404 });
      }

      if (job.status === "QUEUED" || job.status === "PROCESSING") {
        void processVehicleFinanceTrainingValidationJob(job.jobId);
      }

      const result = job.status === "PROCESSED" ? await getVehicleFinanceTrainingResultByDocumentId(job.documentId) : null;
      const metrics = result
        ? {
            pdfTextLength: result.pdfTextLength ?? 0,
            openAiTextLength: result.openAiOcrTextLength ?? 0,
            tesseractTextLength: result.tesseractOcrTextLength ?? 0,
            finalTextLength: result.extractedTextLength,
            confidenceScore: result.confidenceScore,
          }
        : null;

      return NextResponse.json({ job, status: job.status, result, metrics });
    }

    return buildJobResponse(normalizedDocumentId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance-training] validation status failed", error);
    return NextResponse.json({ error: "Vehicle finance training validation status failed" }, { status: 500 });
  }
}


