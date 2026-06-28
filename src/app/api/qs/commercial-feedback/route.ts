import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { createCompletedProjectFeedback, listCompletedProjectFeedback } from "@/lib/qs/commercial-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QSCompletedProjectFeedback } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const feedback = await listCompletedProjectFeedback(500);
    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Commercial feedback could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const body = await request.json() as Partial<QSCompletedProjectFeedback>;
    if (!body.estimateId) return jsonError("estimateId is required.", 400);
    const feedback = await createCompletedProjectFeedback({
      estimateId: body.estimateId,
      projectId: body.projectId ?? null,
      projectName: body.projectName ?? null,
      supplierId: body.supplierId ?? null,
      supplierName: body.supplierName ?? null,
      recommendationId: body.recommendationId ?? null,
      recommendationOutcome: body.recommendationOutcome ?? "pending",
      overrideReason: body.overrideReason ?? null,
      expectedMaterialCost: Number(body.expectedMaterialCost ?? 0),
      actualMaterialCost: Number(body.actualMaterialCost ?? 0),
      expectedLabourCost: Number(body.expectedLabourCost ?? 0),
      actualLabourCost: Number(body.actualLabourCost ?? 0),
      expectedTransportCost: Number(body.expectedTransportCost ?? 0),
      actualTransportCost: Number(body.actualTransportCost ?? 0),
      deliveryPerformanceScore: Number(body.deliveryPerformanceScore ?? 0),
      defectsReturnsRate: Number(body.defectsReturnsRate ?? 0),
      finalProfitMarginPercentage: Number(body.finalProfitMarginPercentage ?? 0),
      projectFeedbackScore: body.projectFeedbackScore ?? null,
      projectFeedbackNotes: body.projectFeedbackNotes ?? null,
      completedAt: body.completedAt ?? new Date().toISOString(),
      createdByUid: user.uid,
      updatedByUid: user.uid,
      createdBy: user.uid,
      updatedBy: user.uid,
    });
    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Commercial feedback could not be saved.");
  }
}
