export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createVehicleFinanceApplication, listVehicleFinanceApplications } from "@/lib/vehicleFinance/vehicleFinanceService";
import { getAvailableInventoryVehicle } from "@/lib/vehicle-finance/inventory/durableInventorySync";
import { sendVehicleFinanceApplicationNotification } from "@/lib/vehicle-finance/notifications/vehicleFinanceApplicationNotification";
function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const applications = await listVehicleFinanceApplications();
    return NextResponse.json({ applications });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] application list failed", error);
    return NextResponse.json({ error: "Vehicle finance applications unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const body = (await request.json()) as Record<string, unknown>;
    const customerId = getString(body.customerId);
    const clientSubmissionId = getString(body.clientSubmissionId);
    let vehicleId = getString(body.vehicleId) || getString(body.vehicleInventoryId) || getString(body.vehicleTitle);
    const vehicleInventoryId = getString(body.vehicleInventoryId);
    let vehicleTitle = getString(body.vehicleTitle) || null;
    let vehiclePrice = getOptionalNumber(body.vehiclePrice);
    let vehicleYear = getOptionalNumber(body.vehicleYear);
    let vehicleMileage = getOptionalNumber(body.vehicleMileage);
    let vehicleImageUrl = getString(body.vehicleImageUrl) || null;
    let vehicleListingUrl = getString(body.vehicleListingUrl) || null;
    let inventorySource = getString(body.inventorySource) || null;
    const dealerName = getString(body.dealerName);
    const dealValue = getNumber(body.dealValue);

    if (!customerId || !vehicleId || !dealerName) {
      return NextResponse.json({ error: "Missing application fields" }, { status: 400 });
    }

    if (vehicleInventoryId) {
      const inventoryVehicle = await getAvailableInventoryVehicle(vehicleInventoryId);
      if (!inventoryVehicle) {
        return NextResponse.json(
          { error: "The selected inventory vehicle is unavailable or no longer synchronized" },
          { status: 409 },
        );
      }
      vehicleId = inventoryVehicle.sourceVehicleId;
      vehicleTitle = inventoryVehicle.title;
      vehiclePrice = inventoryVehicle.priceNumber ?? inventoryVehicle.price;
      vehicleYear = inventoryVehicle.year;
      vehicleMileage = inventoryVehicle.mileageNumber ?? inventoryVehicle.mileage;
      vehicleImageUrl = inventoryVehicle.imageUrl;
      vehicleListingUrl = inventoryVehicle.listingUrl;
      inventorySource = inventoryVehicle.source;
    }

    const existingSubmission = clientSubmissionId
      ? await getFirebaseAdmin().collection("vehicleFinanceApplications").where("clientSubmissionId", "==", clientSubmissionId).limit(1).get()
      : null;
    const shouldSendNotification = !existingSubmission || existingSubmission.empty;

    const application = await createVehicleFinanceApplication(
      {
        customerId,
        vehicleId,
        clientSubmissionId: clientSubmissionId || undefined,
        dealerName,
        dealValue,
        vehicleInventoryId: vehicleInventoryId || undefined,
        vehicleTitle,
        vehiclePrice,
        vehicleYear,
        vehicleMileage,
        vehicleImageUrl,
        vehicleListingUrl,
        inventorySource,
      },
      { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid },
    );

    const notification = shouldSendNotification
      ? await sendVehicleFinanceApplicationNotification({
          application,
          actor: { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid },
        })
      : {
          sent: false,
          skipped: true,
          skipReason: "duplicate_submission",
          attempts: 0,
          resendResponseId: null,
          recipients: [],
          replyTo: null,
          subject: "New Vehicle Finance Application",
          dashboardLink: "",
          error: null,
          queuedForRetry: false,
        };

    try {
      await getFirebaseAdmin().collection("vehicleFinanceNotifications").doc().set({
        applicationId: application.applicationId,
        title: notification.sent ? "New Vehicle Finance Application" : "Application Notification Deferred",
        message: notification.sent
          ? `Application ${application.applicationId} stored and notification dispatched to finance personnel.`
          : `Application ${application.applicationId} stored. Notification delivery deferred or skipped.`,
        channel: "dashboard",
        audience: ["finance", "management", "consultant"],
        unread: true,
        priority: notification.sent ? "HIGH" : "NORMAL",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        readAt: null,
        actorId: user.uid,
        actorName: user.email ?? user.uid,
        actorRole: user.role,
        metadata: {
          recipients: notification.recipients,
          replyTo: notification.replyTo,
          subject: notification.subject,
          dashboardLink: notification.dashboardLink,
          sent: notification.sent,
          skipped: notification.skipped,
          skipReason: notification.skipReason,
          queuedForRetry: notification.queuedForRetry,
        },
      });
    } catch (notificationWriteError) {
      console.warn("[vehicle-finance] notification center write failed", {
        applicationId: application.applicationId,
        error: notificationWriteError instanceof Error ? notificationWriteError.message : String(notificationWriteError),
      });
    }

    return NextResponse.json({ application, notification }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] application create failed", error);
    return NextResponse.json({ error: "Vehicle finance application creation failed" }, { status: 500 });
  }
}
