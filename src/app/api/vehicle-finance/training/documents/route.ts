export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import {
  getVehicleFinanceTrainingOverview,
  uploadVehicleFinanceTrainingDocument,
} from "@/lib/vehicle-finance/training";
import { VEHICLE_FINANCE_TRAINING_CATEGORIES, type VehicleFinanceTrainingCategory } from "@/lib/vehicle-finance/training";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function isTrainingCategory(value: string): value is VehicleFinanceTrainingCategory {
  return (VEHICLE_FINANCE_TRAINING_CATEGORIES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const overview = await getVehicleFinanceTrainingOverview();
    return NextResponse.json({
      documents: overview.documents,
      results: overview.results,
      metrics: overview.metrics,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }
    console.error("[vehicle-finance-training] document list failed", error);
    return jsonError("Vehicle finance training documents unavailable", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const formData = await request.formData();
    const file = formData.get("file");
    const rawCategory = formData.get("category");
    const categoryValue = typeof rawCategory === "string" ? rawCategory.trim() : "";

    if (!(file instanceof File) || file.size <= 0 || !isTrainingCategory(categoryValue)) {
      return jsonError("Missing training document fields", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await uploadVehicleFinanceTrainingDocument(
      {
        category: categoryValue,
        filename: file.name,
        fileBuffer: buffer,
      },
      { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid },
    );

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }
    console.error("[vehicle-finance-training] document upload failed", error);
    return jsonError("Vehicle finance training upload failed", 500);
  }
}
