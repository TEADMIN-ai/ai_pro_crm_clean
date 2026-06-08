import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import {
  createDealDocumentMetadata,
  deleteDealDocument,
  getDealById,
  listDealDocuments,
  updateDealDocumentReview,
} from "@/server/services/dealService";
import { canDelete, canReview } from "@/lib/auth/roleUtils";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { extractTextFromPdf } from "@/lib/pdf/extractTextFromPdf";

const DEAL_DOCUMENT_SIGNED_URL_TTL_MS = 5 * 60 * 1000;

function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "document.pdf";
}

async function resolveDealId(context: { params: Promise<{ dealId: string }> }) {
  const { dealId: rawDealId } = await context.params;
  return decodeURIComponent(rawDealId ?? "").trim();
}

function hasRequiredMetadata(metadata: {
  dealId?: string;
  fileName?: string;
  uploadedBy?: string;
  createdAt?: string;
}) {
  return Boolean(metadata.dealId && metadata.fileName && metadata.uploadedBy && metadata.createdAt);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const dealId = await resolveDealId(context);

    if (!dealId) {
      return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
    }

    const deal = await getDealById(dealId);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.contractorId) {
      assertCanAccessContractor(actor, deal.contractorId);
    }

    const documents = await listDealDocuments(dealId);
    return NextResponse.json({ documents }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch deal documents:", error);
    return NextResponse.json({ error: "Failed to fetch deal documents" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const dealId = await resolveDealId(context);

    console.log("[deal-documents][POST] request received", {
      actorUid: actor.uid,
      actorRole: actor.role,
      dealId,
    });

    if (!dealId) {
      console.error("[deal-documents][POST] missing dealId in route params");
      return NextResponse.json({ success: false, error: "Missing dealId" }, { status: 400 });
    }

    const deal = await getDealById(dealId);

    if (!deal) {
      console.error("[deal-documents][POST] deal not found", { dealId });
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.contractorId) {
      assertCanAccessContractor(actor, deal.contractorId);
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      console.log("[deal-documents][POST] parsing multipart form data", { dealId });
      const formData = await request.formData();
      const uploadedFile = formData.get("file");

      if (!(uploadedFile instanceof File)) {
        console.error("[deal-documents][POST] multipart request missing file", { dealId });
        return NextResponse.json({ success: false, error: "Missing PDF file" }, { status: 400 });
      }

      if (!uploadedFile.name.toLowerCase().endsWith(".pdf")) {
        console.error("[deal-documents][POST] rejected non-pdf upload", {
          dealId,
          fileName: uploadedFile.name,
        });
        return NextResponse.json({ success: false, error: "Only PDF files are allowed" }, { status: 400 });
      }

      console.log("[deal-documents][POST] uploading file to storage", {
        dealId,
        fileName: uploadedFile.name,
        size: uploadedFile.size,
      });

      const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
      const timestamp = Date.now();
      const safeFilename = sanitizeFilename(uploadedFile.name);
      const filePath = `uploads/deals/${dealId}/${timestamp}_${safeFilename}`;
      getFirebaseAdmin();
      const bucket = getFirebaseStorageBucket();
      const file = bucket.file(filePath);

      await file.save(fileBuffer, {
        metadata: {
          contentType: uploadedFile.type || "application/pdf",
        },
      });

      console.log("[deal-documents][POST] file uploaded to storage", { dealId, filePath });

      const [downloadURL] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + DEAL_DOCUMENT_SIGNED_URL_TTL_MS,
      });

      const uploadedAt = Timestamp.now();
      let extractedText = "";
      let extractionError: string | null = null;

      try {
        extractedText = await extractTextFromPdf(fileBuffer);
        console.log("[deal-documents][POST] pdf text extracted", {
          dealId,
          fileName: uploadedFile.name,
          textLength: extractedText.length,
        });
      } catch (error) {
        extractionError = "PDF extraction failed";
        console.error("[deal-documents][POST] pdf extraction failed", {
          dealId,
          fileName: uploadedFile.name,
          error,
        });
      }

      const db = getFirebaseAdmin();
      const metadataRef = db.collection("deals").doc(dealId).collection("documents").doc();
      const createdAt = new Date().toISOString();
      const metadata = {
        id: metadataRef.id,
        dealId,
        fileName: uploadedFile.name,
        name: uploadedFile.name,
        originalName: uploadedFile.name,
        contentType: uploadedFile.type || "application/pdf",
        size: uploadedFile.size,
        storagePath: filePath,
        filePath,
        downloadURL,
        uploadedBy: actor.email ?? actor.uid,
        uploadedByUid: actor.uid,
        uploadedByRole: actor.role,
        createdAt,
        uploadedAt,
        updatedAt: uploadedAt,
        status: "pending",
        isExpired: false,
        reviewedAt: null,
        version: 1,
        extractedText,
        textLength: extractedText.length,
      };

      if (!hasRequiredMetadata(metadata)) {
        console.error("[deal-documents][POST] metadata validation failed", {
          dealId: metadata.dealId,
          fileName: metadata.fileName,
          uploadedBy: metadata.uploadedBy,
          createdAt: metadata.createdAt,
        });
        return NextResponse.json(
          { error: "Failed to store deal document metadata" },
          { status: 500 },
        );
      }

      console.log("Uploading deal document metadata:", metadata);

      try {
        await metadataRef.set(metadata);
      } catch (error) {
        console.error("Deal document metadata write failed:", error);
        return NextResponse.json(
          { error: "Failed to store deal document metadata" },
          { status: 500 },
        );
      }

      console.log("[deal-documents][POST] metadata stored in firestore", {
        dealId,
        documentId: metadataRef.id,
      });

      const snapshot = await metadataRef.get();
      const document = {
        id: snapshot.id,
        ...(snapshot.data() ?? {}),
      };

      return NextResponse.json(
        {
          success: true,
          document,
          ...(extractionError ? { extraction: { success: false, error: extractionError } } : {}),
        },
        { status: 200 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const document = await createDealDocumentMetadata({
      dealId,
      name: typeof body.name === "string" ? body.name : "document.pdf",
      contentType: typeof body.contentType === "string" ? body.contentType : undefined,
      size: typeof body.size === "number" ? body.size : undefined,
      storagePath: typeof body.storagePath === "string" ? body.storagePath : "",
      downloadURL: typeof body.downloadURL === "string" ? body.downloadURL : "",
      uploadedByUid: actor.uid,
      uploadedByRole: actor.role,
    });

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("Failed to create deal document:", error);
    return NextResponse.json({ success: false, error: "Failed to create deal document" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const dealId = await resolveDealId(context);

    if (!dealId) {
      return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const status = body.status === "approved" || body.status === "rejected" ? body.status : null;
    const deal = await getDealById(dealId);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.contractorId) {
      assertCanAccessContractor(actor, deal.contractorId);
    }

    if (!status || !documentId || !canReview(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const document = await updateDealDocumentReview({
      dealId,
      documentId,
      reviewerUid: actor.uid,
      reviewerRole: actor.role,
      status,
    });

    return NextResponse.json({ document }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update deal document:", error);
    return NextResponse.json({ error: "Failed to update deal document" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const dealId = await resolveDealId(context);

    if (!dealId) {
      return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
    }

    const documentId = request.nextUrl.searchParams.get("documentId") ?? "";
    const deal = await getDealById(dealId);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.contractorId) {
      assertCanAccessContractor(actor, deal.contractorId);
    }

    const documents = await listDealDocuments(dealId);
    const target = documents.find((item) => item.id === documentId);

    if (!target) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!canDelete(actor.role, target.uploadedByUid, actor.uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteDealDocument({ dealId, documentId });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to delete deal document:", error);
    return NextResponse.json({ error: "Failed to delete deal document" }, { status: 500 });
  }
}
