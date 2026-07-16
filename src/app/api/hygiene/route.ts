import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import {
  assignHygieneBackupTransport,
  generateHygieneManifest,
  getHygieneDashboardData,
  seedCbavoHygieneDataset,
  updateHygieneManifest,
  upsertHygieneClient,
  upsertHygieneCollection,
  upsertHygieneSite,
} from "@/lib/hygiene/hygieneService";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Hygiene request failed";
  console.error("[HYGIENE_API_ERROR]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const showTestData = request.nextUrl.searchParams.get("showTestData") === "1" ? true : request.nextUrl.searchParams.get("showTestData") === "true"
    const data = await getHygieneDashboardData(user, { showTestData });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown> & { action?: string };
    if (body.action === "seed-cbavo") {
      const result = await seedCbavoHygieneDataset(user);
      return NextResponse.json({ success: true, ...result });
    }

    if (body.action === "upsert-client") {
      const record = await upsertHygieneClient(user, body as never);
      return NextResponse.json({ success: true, record });
    }

    if (body.action === "upsert-site") {
      const record = await upsertHygieneSite(user, body as never);
      return NextResponse.json({ success: true, record });
    }

    if (body.action === "upsert-collection") {
      const record = await upsertHygieneCollection(user, body as never);
      return NextResponse.json({ success: true, record });
    }

    if (body.action === "assign-backup-transport") {
      const record = await assignHygieneBackupTransport(user, {
        collectionId: typeof body.collectionId === "string" ? body.collectionId : "",
        backupVehicleUsed: Boolean(body.backupVehicleUsed),
        backupDriverUsed: Boolean(body.backupDriverUsed),
        vehicleRegistration: typeof body.vehicleRegistration === "string" ? body.vehicleRegistration : "",
        driverName: typeof body.driverName === "string" ? body.driverName : "",
        reason: typeof body.reason === "string" ? body.reason : "",
        approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : "",
      });
      return NextResponse.json({ success: true, record });
    }

    if (body.action === "generate-manifest") {
      const manifest = await generateHygieneManifest(user, typeof body.collectionId === "string" ? body.collectionId : "");
      return NextResponse.json({ success: true, manifest });
    }

    if (body.action === "update-manifest") {
      const manifest = await updateHygieneManifest(user, body as never);
      return NextResponse.json({ success: true, manifest });
    }

    return NextResponse.json({ error: "Unsupported hygiene admin action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
