import { NextRequest, NextResponse } from "next/server";
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const { dealId } = await context.params;
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
    const { dealId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const deal = await getDealById(dealId);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.contractorId) {
      assertCanAccessContractor(actor, deal.contractorId);
    }

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

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to create deal document:", error);
    return NextResponse.json({ error: "Failed to create deal document" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const { dealId } = await context.params;
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
    const { dealId } = await context.params;
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
