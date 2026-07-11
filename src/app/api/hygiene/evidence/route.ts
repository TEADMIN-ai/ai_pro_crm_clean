import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { createHygieneEvidencePhoto } from "@/lib/hygiene/hygieneService";
import { HYGIENE_PHOTO_CATEGORIES, type HygienePhotoCategory } from "@/types/hygiene";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const dynamic = "force-dynamic";

function getRequiredFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Evidence upload failed";
  console.error("[HYGIENE_EVIDENCE_UPLOAD_ERROR]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Evidence photo file is required." }, { status: 400 });
    }

    const category = getRequiredFormString(formData, "category");
    if (!HYGIENE_PHOTO_CATEGORIES.includes(category as HygienePhotoCategory)) {
      return NextResponse.json({ error: "Unsupported evidence photo category." }, { status: 400 });
    }

    const clientId = getRequiredFormString(formData, "clientId");
    const siteId = getRequiredFormString(formData, "siteId");
    const collectionId = getRequiredFormString(formData, "collectionId");
    const manifestId = getRequiredFormString(formData, "manifestId");
    const notes = typeof formData.get("notes") === "string" ? String(formData.get("notes")).trim() : "Uploaded from hygiene evidence workflow.";
    const latitudeValue = Number(formData.get("latitude"));
    const longitudeValue = Number(formData.get("longitude"));
    const accuracyValue = Number(formData.get("gpsAccuracy"));
    const deviceInfoRaw = formData.get("deviceInfo");
    const deviceInfo = typeof deviceInfoRaw === "string" && deviceInfoRaw ? JSON.parse(deviceInfoRaw) as Record<string, unknown> : {};
    const photoId = `TE-EP-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const storagePath = `hygiene/evidence/${clientId}/${collectionId}/${photoId}-${safeFileName}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const bucketFile = getFirebaseStorageBucket().file(storagePath);
    await bucketFile.save(bytes, {
      contentType: file.type || "application/octet-stream",
      resumable: false,
      metadata: {
        metadata: {
          clientId,
          siteId,
          collectionId,
          manifestId,
          category,
          uploadedByUid: user.uid,
        },
      },
    });

    const [signedUrl] = await bucketFile.getSignedUrl({
      action: "read",
      expires: "2036-01-01",
    });

    const record = await createHygieneEvidencePhoto(user, {
      photoId,
      clientId,
      siteId,
      collectionId,
      manifestId,
      category: category as HygienePhotoCategory,
      uploadedBy: user.email ?? user.uid,
      uploadedAt: new Date().toISOString(),
      fileUrl: signedUrl,
      timestampFromImage: null,
      notes,
      metadata: {
        latitude: Number.isFinite(latitudeValue) ? latitudeValue : null,
        longitude: Number.isFinite(longitudeValue) ? longitudeValue : null,
        gpsAccuracy: Number.isFinite(accuracyValue) ? accuracyValue : null,
        gps: {
          latitude: Number.isFinite(latitudeValue) ? latitudeValue : null,
          longitude: Number.isFinite(longitudeValue) ? longitudeValue : null,
          accuracy: Number.isFinite(accuracyValue) ? accuracyValue : null,
        },
        deviceInfo,
      },
    });

    return NextResponse.json({ success: true, photo: record });
  } catch (error) {
    return errorResponse(error);
  }
}
