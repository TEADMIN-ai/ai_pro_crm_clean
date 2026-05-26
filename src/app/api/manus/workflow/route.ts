import { NextRequest, NextResponse } from "next/server";
import type { WorkflowExecutionPayload } from "@/lib/manus/types/manus.types";
import { WorkflowExecutor } from "@/lib/manus/executors/workflowExecutor";
import { bootstrapWorkflow } from "@/lib/manus/executors/workflowBootstrap";
import { createComplianceWorkflow } from "@/lib/manus/workflows/complianceWorkflow";
import { createOnboardingWorkflow } from "@/lib/manus/workflows/onboardingWorkflow";
import { createTenderWorkflow } from "@/lib/manus/workflows/tenderWorkflow";
import { validateWorkflowPayload } from "@/lib/manus/utils/workflowValidator";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";

function jsonError(message: string, status = 500, detail?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...detail }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const body = (await request.json()) as WorkflowExecutionPayload;
    validateWorkflowPayload(body);

    const bootstrap = bootstrapWorkflow({
      actor: user,
      workflowType: body.workflowType,
      contractorId: body.contractorId,
      dealId: body.dealId,
      documentType: body.documentType,
      payload: body.input,
      dryRun: body.options?.dryRun ?? true,
    });

    if (!bootstrap.ok || !bootstrap.context) {
      return jsonError(bootstrap.message, bootstrap.status, { code: bootstrap.code });
    }

    const workflow =
      body.workflowType === "tender"
        ? createTenderWorkflow(
            typeof body.input.documentBase64 === "string" && body.input.documentBase64
              ? Buffer.from(body.input.documentBase64, "base64")
              : Buffer.from("")
          )
        : body.workflowType === "compliance"
          ? createComplianceWorkflow(
              Array.isArray(body.input.requiredDocuments)
                ? body.input.requiredDocuments.filter((value): value is string => typeof value === "string")
                : []
            )
          : createOnboardingWorkflow();

    if (body.workflowType === "tender" && (!body.input.documentBase64 || typeof body.input.documentBase64 !== "string")) {
      return jsonError("documentBase64 is required for tender workflows", 400);
    }

    const result = await new WorkflowExecutor().execute(workflow, bootstrap.context);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Failed to execute Manus workflow");
  }
}
