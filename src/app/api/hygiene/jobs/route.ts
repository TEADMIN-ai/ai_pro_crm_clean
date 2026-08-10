import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { expectedHygieneSignaturePath } from "@/lib/master-data/storagePathPolicy";
import { completeHygieneDriverAction, createHygieneSignature, generateHygieneManifest, getHygieneMobileJobs, HygieneWorkflowError } from "@/lib/hygiene/hygieneService";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const dynamic = "force-dynamic";

type JobAction =
  | "accept-job"
  | "start-travel"
  | "vehicle-inspection"
  | "start-job"
  | "start-collection"
  | "arrival"
  | "confirm-arrival"
  | "begin-collection"
  | "waste-collection"
  | "before-photo"
  | "checklist"
  | "record-bin-count"
  | "bag-removed"
  | "liner-installed"
  | "bin-sanitised"
  | "after-photo"
  | "capture-evidence"
  | "capture-signature"
  | "bin-serviced"
  | "load-waste"
  | "confirm-disposal"
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
  gpsAccuracy?: number;
  deviceInfo?: Record<string, unknown>;
  quantity?: number;
  manifestId?: string;
  checklist?: Record<string, boolean>;
  category?: string;
  adminOverrideReason?: string;
  representativeName?: string;
  representativePosition?: string;
  signatureDataUrl?: string;
  signatureDrawn?: boolean;
  signatureStrokeCount?: number;
};

type HygieneJobsRequestContext = {
  method: "GET" | "POST";
  userId?: string;
  role?: string;
  workspaceId?: string;
  action?: string;
  collectionId?: string;
  stage: string;
};

function logHygieneJobsFailure(error: unknown, context: HygieneJobsRequestContext) {
  const errorInfo = {
    method: context.method,
    userId: context.userId ?? "unauthenticated",
    role: context.role ?? "unknown",
    workspaceId: context.workspaceId ?? "default",
    action: context.action ?? null,
    collectionId: context.collectionId ?? null,
    stage: context.stage,
    errorType: error instanceof Error ? error.name : typeof error,
    errorCode: error instanceof HygieneWorkflowError ? error.code : error instanceof AuthorizationError ? `auth_${error.status}` : "unexpected",
    message: error instanceof Error ? error.message : "Hygiene mobile job request failed",
  };

  if (error instanceof HygieneWorkflowError || error instanceof AuthorizationError) {
    console.warn("[HYGIENE_JOBS_CONTROLLED_ERROR]", errorInfo);
    return;
  }

  console.error("[HYGIENE_JOBS_UNEXPECTED_ERROR]", errorInfo, error);
}

function errorResponse(error: unknown, context: HygieneJobsRequestContext) {
  if (error instanceof AuthorizationError) {
    logHygieneJobsFailure(error, context);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof HygieneWorkflowError) {
    logHygieneJobsFailure(error, context);
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (error instanceof SyntaxError) {
    logHygieneJobsFailure(error, context);
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Hygiene mobile job request failed";
  logHygieneJobsFailure(error, context);
  return NextResponse.json({ error: message }, { status: 500 });
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HygieneWorkflowError(`${label} is required.`, 400, "hygiene_request_invalid");
  }

  return value.trim();
}

function requireDrawnSignature(body: JobPayload): void {
  const strokeCount = typeof body.signatureStrokeCount === "number" ? body.signatureStrokeCount : 0;
  if (body.signatureDrawn !== true || strokeCount <= 0) {
    throw new HygieneWorkflowError("A drawn customer signature is required.", 400, "hygiene_signature_blank");
  }
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
}): Promise<{ storagePath: string }> {
  const { buffer, contentType } = decodeDataUrl(input.dataUrl);
  const storagePath = expectedHygieneSignaturePath({
    clientId: input.clientId,
    collectionId: input.collectionId,
    signatureId: input.signatureId,
  });
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

  return { storagePath };
}

export async function GET(request: NextRequest) {
  const context: HygieneJobsRequestContext = { method: "GET", stage: "auth" };
  try {
    const user = await requireAuthorizedUser(request);
    context.userId = user.uid;
    context.role = user.role;
    context.stage = "list_jobs";
    const data = await getHygieneMobileJobs(user);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, context);
  }
}

export async function POST(request: NextRequest) {
  const context: HygieneJobsRequestContext = { method: "POST", stage: "auth" };
  try {
    const user = await requireAuthorizedUser(request);
    context.userId = user.uid;
    context.role = user.role;
    context.stage = "parse_payload";
    const body = (await request.json().catch(() => ({}))) as JobPayload;
    const action = requireString(body.action, "action") as JobAction;
    const collectionId = requireString(body.collectionId, "collectionId");
    context.action = action;
    context.collectionId = collectionId;
    context.stage = "validate_action";

    if (!["accept-job", "start-travel", "vehicle-inspection", "start-job", "start-collection", "arrival", "confirm-arrival", "begin-collection", "waste-collection", "before-photo", "checklist", "record-bin-count", "bag-removed", "liner-installed", "bin-sanitised", "after-photo", "capture-evidence", "capture-signature", "bin-serviced", "load-waste", "confirm-disposal", "quantity", "manifest", "generate-manifest", "signature", "awaiting-disposal", "complete-job"].includes(action)) {
      return NextResponse.json({ error: "Unsupported mobile job action." }, { status: 400 });
    }

    if (action === "signature") {
      context.stage = "capture_signature";
      const signatureId = `TE-SIG-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const representativeName = requireString(body.representativeName, "representativeName");
      const representativePosition = requireString(body.representativePosition, "representativePosition");
      const signatureDataUrl = requireString(body.signatureDataUrl, "signatureDataUrl");
      requireDrawnSignature(body);
      const jobs = await getHygieneMobileJobs(user);
      const collection = jobs.collections.find((item) => item.collectionId === collectionId);
      if (!collection) {
        throw new AuthorizationError("This hygiene collection is not assigned to the current user.", 403);
      }

      const uploadedSignature = await uploadSignature({
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
        signatureFileUrl: null,
        signatureStoragePath: uploadedSignature.storagePath,
        metadata: {
          latitude: typeof body.latitude === "number" ? body.latitude : null,
          longitude: typeof body.longitude === "number" ? body.longitude : null,
          gpsAccuracy: typeof body.gpsAccuracy === "number" ? body.gpsAccuracy : null,
          gps: {
            latitude: typeof body.latitude === "number" ? body.latitude : null,
            longitude: typeof body.longitude === "number" ? body.longitude : null,
            accuracy: typeof body.gpsAccuracy === "number" ? body.gpsAccuracy : null,
          },
          deviceInfo: body.deviceInfo && typeof body.deviceInfo === "object" ? body.deviceInfo : {},
          signatureStoragePath: uploadedSignature.storagePath,
          signatureFileUrl: null,
        },
      });

      return NextResponse.json({ success: true, signature });
    }

    if (action === "manifest" || action === "generate-manifest") {
      context.stage = "generate_manifest";
      const manifest = await generateHygieneManifest(user, collectionId);
      return NextResponse.json({ success: true, manifest });
    }

    const normalizedAction =
      action === "start-job" ? "accept-job"
      : action === "arrival" ? "confirm-arrival"
      : action === "start-travel" ? "start-travel"
      : action === "accept-job" ? "accept-job"
      : action === "begin-collection" ? "waste-collection"
      : action === "waste-collection" ? "waste-collection"
      : action === "capture-evidence" ? "capture-evidence"
      : action === "capture-signature" ? "capture-signature"
      : action === "bin-serviced" ? "bin-serviced"
      : action === "load-waste" ? "load-waste"
      : action === "confirm-disposal" ? "confirm-disposal"
      : action === "checklist" ? "bag-removed"
      : action === "quantity" ? "record-bin-count"
      : action;

    context.stage = "complete_driver_action";
    const event = await completeHygieneDriverAction(user, {
      collectionId,
      action: normalizedAction,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : `Mobile workflow action: ${normalizedAction}`,
      metadata: {
        latitude: typeof body.latitude === "number" ? body.latitude : null,
        longitude: typeof body.longitude === "number" ? body.longitude : null,
        gpsAccuracy: typeof body.gpsAccuracy === "number" ? body.gpsAccuracy : null,
        gps: {
          latitude: typeof body.latitude === "number" ? body.latitude : null,
          longitude: typeof body.longitude === "number" ? body.longitude : null,
          accuracy: typeof body.gpsAccuracy === "number" ? body.gpsAccuracy : null,
        },
        deviceInfo: body.deviceInfo && typeof body.deviceInfo === "object" ? body.deviceInfo : {},
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
    return errorResponse(error, context);
  }
}
