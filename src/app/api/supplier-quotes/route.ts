import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import {
  compareSupplierQuotesForDeal,
  listSupplierQuotesForDeal,
  uploadSupplierQuote,
} from "@/server/services/supplierQuoteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function statusFromError(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : 500;
}

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formNumber(formData: FormData, key: string): number | null {
  const value = formString(formData, key);
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get("dealId")?.trim();
    if (!dealId) return jsonError("dealId is required.", 400);
    if (searchParams.get("view") === "comparison") {
      return NextResponse.json({ comparison: await compareSupplierQuotesForDeal(dealId, actor) });
    }
    return NextResponse.json({ quotes: await listSupplierQuotesForDeal(dealId, actor) });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier quotes could not be loaded.", statusFromError(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : null;
      const supplierName = formString(formData, "supplierName");
      const opportunityId = formString(formData, "opportunityId");
      const dealId = formString(formData, "dealId");
      if (!supplierName || !opportunityId || !dealId) return jsonError("supplierName, opportunityId, and dealId are required.", 400);

      const result = await uploadSupplierQuote({
        workspaceId: formString(formData, "workspaceId"),
        opportunityId,
        dealId,
        contractorId: formString(formData, "contractorId"),
        contractorName: formString(formData, "contractorName"),
        supplierId: formString(formData, "supplierId"),
        supplierName,
        supplierRegistrationNumber: formString(formData, "supplierRegistrationNumber"),
        supplierContactName: formString(formData, "supplierContactName"),
        supplierEmail: formString(formData, "supplierEmail"),
        supplierPhone: formString(formData, "supplierPhone"),
        quotationNumber: formString(formData, "quotationNumber"),
        quotationDate: formString(formData, "quotationDate"),
        validityDate: formString(formData, "validityDate"),
        currency: formString(formData, "currency"),
        subtotal: formNumber(formData, "subtotal"),
        vat: formNumber(formData, "vat"),
        total: formNumber(formData, "total"),
        deliveryCost: formNumber(formData, "deliveryCost"),
        deliveryPeriod: formString(formData, "deliveryPeriod"),
        paymentTerms: formString(formData, "paymentTerms"),
        uploadedDocumentId: formString(formData, "uploadedDocumentId"),
        storagePath: formString(formData, "storagePath"),
        sourceFileName: file instanceof File ? file.name : formString(formData, "sourceFileName"),
        fileBuffer: buffer,
        contentType: file instanceof File ? file.type : null,
        createdBy: actor.uid,
      }, actor);
      return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
    }

    const body = await request.json().catch(() => ({}));
    if (!body.supplierName || !body.opportunityId || !body.dealId) {
      return jsonError("supplierName, opportunityId, and dealId are required.", 400);
    }
    const result = await uploadSupplierQuote({ ...body, createdBy: actor.uid }, actor);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier quote could not be uploaded.", statusFromError(error));
  }
}
