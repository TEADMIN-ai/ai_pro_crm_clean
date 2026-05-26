import { NextRequest, NextResponse } from "next/server";
import { bootstrapWorkflow } from "@/lib/manus/executors/workflowBootstrap";
import { WorkflowExecutor } from "@/lib/manus/executors/workflowExecutor";
import { createTenderWorkflow } from "@/lib/manus/workflows/tenderWorkflow";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";

function jsonError(message: string, status = 500, detail?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...detail }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const formData = await request.formData();
    const contractorId = typeof formData.get("contractorId") === "string" ? String(formData.get("contractorId")).trim() : "";
    const dealId = typeof formData.get("dealId") === "string" ? String(formData.get("dealId")).trim() : undefined;
    const documentType = typeof formData.get("documentType") === "string" ? String(formData.get("documentType")).trim() : undefined;
    const file = formData.get("file");

    if (!contractorId) {
      return jsonError("contractorId is required", 400);
    }

    if (!(file instanceof File)) {
      return jsonError("file is required", 400);
    }

    const bootstrap = bootstrapWorkflow({
      actor: user,
      workflowType: "tender",
      contractorId,
      dealId,
      documentType,
      payload: {
        contractorId,
        dealId,
        documentType,
        fileName: file.name,
        fileSize: file.size,
      },
      dryRun: true,
    });

    if (!bootstrap.ok || !bootstrap.context) {
      return jsonError(bootstrap.message, bootstrap.status, { code: bootstrap.code });
    }

    const documentBuffer = Buffer.from(await file.arrayBuffer());
    const workflow = createTenderWorkflow(documentBuffer);
    const result = await new WorkflowExecutor().execute(workflow, bootstrap.context);

    return NextResponse.json({
      ...result,
      dryRun: true,
      informationalOnly: true,
      notificationsSent: false,
      submissionsTriggered: false,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Failed to execute tender workflow");
  }
}
