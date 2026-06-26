import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { completeHygieneDriverAction, createHygieneSignature, generateHygieneManifest, getHygieneMobileJobs } from "@/lib/hygiene/hygieneService";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const dynamic = "force-dynamic";

type JobAction =
  | "vehicle-inspection"
  | "start-job"
  | "start-collection"
  | "arrival"
  | "confirm-arrival"
  | "before-photo"
  | "checklist"
  | "record-bin-count"
  | "bag-removed"
  | "liner-installed"
  | "bin-sanitised"
  | "after-photo"
  | "quantity"
  | "manifest"
  | "generate-manifest"
  | "signature"
  | "awaiting-disposal"
  | "complete-job";

type JobPayload = {
  action?: JobAction;
  collectionId?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  quantity?: number;
  manifestId?: string;
  checklist?: Record<string, boolean>;
  category?: string;
  adminOverrideReason?: string;
  representativeName?: string;
  representativePosition?: string;
  signatureDataUrl?: string;
};

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Hygiene mobile job request failed";
  console.error("[HYGIENE_MOBILE_JOB_ERROR]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Signature must be a base64 data URL.");
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function uploadSignature(input: {
  dataUrl: string;
  clientId: string;
  siteId: string;
  collectionId: string;
  signatureId: string;
}): Promise<string> {
  const { buffer, contentType } = decodeDataUrl(input.dataUrl);
  const storagePath = `hygiene/signatures/${input.clientId}/${input.collectionId}/${input.signatureId}.png`;
  const bucketFile = getFirebaseStorageBucket().file(storagePath);
  await bucketFile.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      metadata: {
        clientId: input.clientId,
        siteId: input.siteId,
        collectionId: input.collectionId,
      },
    },
  });

  const [signedUrl] = await bucketFile.getSignedUrl({
    action: "read",
    expires: "2036-01-01",
  });

  return signedUrl;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const data = await getHygieneMobileJobs(user);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const body = (await request.json().catch(() => ({}))) as JobPayload;
    const action = requireString(body.action, "action") as JobAction;
    const collectionId = requireString(body.collectionId, "collectionId");

    if (!["vehicle-inspection", "start-job", "start-collection", "arrival", "confirm-arrival", "before-photo", "checklist", "record-bin-count", "bag-removed", "liner-installed", "bin-sanitised", "after-photo", "quantity", "manifest", "generate-manifest", "signature", "awaiting-disposal", "complete-job"].includes(action)) {
      return NextResponse.json({ error: "Unsupported mobile job action." }, { status: 400 });
    }

    if (action === "signature") {
      const signatureId = `TE-SIG-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const representativeName = requireString(body.representativeName, "representativeName");
      const representativePosition = requireString(body.representativePosition, "representativePosition");
      const signatureDataUrl = requireString(body.signatureDataUrl, "signatureDataUrl");
      const jobs = await getHygieneMobileJobs(user);
      const collection = jobs.collections.find((item) => item.collectionId === collectionId);
      if (!collection) {
        throw new AuthorizationError("This hygiene collection is not assigned to the current user.", 403);
      }

      const signatureFileUrl = await uploadSignature({
        dataUrl: signatureDataUrl,
        clientId: collection.clientId,
        siteId: collection.siteId,
        collectionId,
        signatureId,
      });

      const signature = await createHygieneSignature(user, {
        signatureId,
        clientId: collection.clientId,
        siteId: collection.siteId,
        collectionId,
        manifestId: collection.manifestId === "Pending" ? null : collection.manifestId,
        representativeName,
        representativePosition,
        signatureDataUrl: undefined,
        signatureFileUrl,
      });

      return NextResponse.json({ success: true, signature });
    }

    if (action === "manifest" || action === "generate-manifest") {
      const manifest = await generateHygieneManifest(user, collectionId);
      return NextResponse.json({ success: true, manifest });
    }

    const normalizedAction =
      action === "start-job" ? "start-collection"
      : action === "arrival" ? "confirm-arrival"
      : action === "checklist" ? "bag-removed"
      : action === "quantity" ? "record-bin-count"
      : action;

    const event = await completeHygieneDriverAction(user, {
      collectionId,
      action: normalizedAction,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : `Mobile workflow action: ${normalizedAction}`,
      metadata: {
        latitude: typeof body.latitude === "number" ? body.latitude : null,
        longitude: typeof body.longitude === "number" ? body.longitude : null,
        binCount: typeof body.quantity === "number" ? body.quantity : null,
        quantity: typeof body.quantity === "number" ? body.quantity : null,
        manifestId: typeof body.manifestId === "string" ? body.manifestId : null,
        checklist: body.checklist ?? {},
        category: typeof body.category === "string" ? body.category : null,
        step: normalizedAction,
        adminOverrideReason: typeof body.adminOverrideReason === "string" ? body.adminOverrideReason : "",
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    return errorResponse(error);
  }
}
