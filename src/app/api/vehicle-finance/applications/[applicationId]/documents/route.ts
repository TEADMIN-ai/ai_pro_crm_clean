export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import {
  listVehicleFinanceDocuments,
  normalizeVehicleFinanceDocumentType,
  uploadVehicleFinanceDocument,
} from "@/lib/vehicleFinance/vehicleFinanceService";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const { applicationId } = await context.params;
    const documents = await listVehicleFinanceDocuments(applicationId);
    return NextResponse.json({ documents });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }
    console.error("[vehicle-finance] document list failed", error);
    return jsonError("Vehicle finance documents unavailable", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const { applicationId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const documentType = normalizeVehicleFinanceDocumentType(formData.get("documentType"));

    if (!(file instanceof File) || !documentType || file.size <= 0) {
      return jsonError("Missing document upload fields", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await uploadVehicleFinanceDocument(
      {
        applicationId,
        documentType,
        fileName: file.name,
        fileBuffer: buffer,
      },
      { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid },
    );

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }
    console.error("[vehicle-finance] document upload failed", error);
    return jsonError("Vehicle finance document upload failed", 500);
  }
}
