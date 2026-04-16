import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { adminDb } from "@/lib/firebaseAdmin";
import { fillSbd1 } from "@/lib/empirePdf/fillSbd1";
import { fillSbd4 } from "@/lib/empirePdf/fillSbd4";
import { generateTenderPdf } from "@/lib/pdf/generateTenderPdf";
import { mergeTenderPack } from "@/lib/pdf/mergeTenderPack";
import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TEST_MODE = true;

type GenerateBody = {
  dealId?: string;
  contractorId?: string;
};

type TenderDealData = {
  id: string;
  title: string;
  value: number | null;
  readinessScore: number;
  missingDocs: string[];
  riskLevel: string;
  suggestions: string[];
};

type TenderContractorData = {
  id: string;
  companyName: string;
  registrationNumber: string | null;
  bbbeeStatus: string | null;
  contactPerson?: string | null;
  directorName?: string | null;
};

type SupportingDocumentRecord = {
  id: string;
  fileUrl: string;
};

function normalizePdfBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }

  return null;
}

function isValidPdfBytes(value: unknown): value is Uint8Array {
  const bytes = normalizePdfBytes(value);

  if (!bytes || bytes.length < 5) {
    return false;
  }

  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown): string | null {
  const normalized = getString(value);
  return normalized.length > 0 ? normalized : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

async function fetchSupportingDocumentBytes(fileUrl: string): Promise<Uint8Array> {
  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error(`Supporting document fetch failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function loadSupportingDocuments(dealId: string): Promise<Uint8Array[]> {
  const supportingSnapshot = await adminDb
    .collection("documents")
    .where("dealId", "==", dealId)
    .where("type", "==", "supporting")
    .get();

  const supportingDocs: SupportingDocumentRecord[] = supportingSnapshot.docs
    .map((doc) => {
      const data = doc.data() ?? {};
      const fileUrl = getString(data.fileUrl);

      return {
        id: doc.id,
        fileUrl,
      };
    })
    .filter((document) => document.fileUrl.length > 0);

  const loadedDocs = await Promise.all(
    supportingDocs.map(async (document) => {
      try {
        const bytes = await fetchSupportingDocumentBytes(document.fileUrl);
        await PDFDocument.load(bytes);
        return bytes;
      } catch (error) {
        console.warn("SUPPORTING DOC SKIPPED:", {
          documentId: document.id,
          fileUrl: document.fileUrl,
          error: error instanceof Error ? error.message : error,
        });
        return null;
      }
    })
  );

  return loadedDocs.filter((document): document is Uint8Array => document instanceof Uint8Array);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    const body = (await request.json()) as GenerateBody;
    const dealId = getString(body.dealId);
    const contractorId = getString(body.contractorId);

    if (!dealId || !contractorId) {
      return NextResponse.json({ error: "dealId and contractorId are required" }, { status: 400 });
    }

    const dealSnapshot = await adminDb.collection("deals").doc(dealId).get();
    if (!dealSnapshot.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const dealData = dealSnapshot.data() ?? {};
    const storedContractorId = getString(dealData.contractorId);

    if (!storedContractorId || storedContractorId !== contractorId) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    assertCanAccessContractor(user, contractorId);

    const contractorSnapshot = await adminDb.collection("contractors").doc(contractorId).get();
    if (!contractorSnapshot.exists) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    const readinessScore = getNumber(dealData.readinessScore) ?? 0;
    console.log("TEST MODE:", TEST_MODE);
    console.log("READINESS SCORE:", readinessScore);
    if (!TEST_MODE && readinessScore < 60) {
      return NextResponse.json(
        { error: "Deal not ready for tender pack generation" },
        { status: 400 }
      );
    }

    const contractorData = contractorSnapshot.data() ?? {};

    const deal: TenderDealData = {
      id: dealSnapshot.id,
      title: getString(dealData.title) || getString(dealData.name) || dealSnapshot.id,
      value: getNumber(dealData.value),
      readinessScore,
      missingDocs: getStringArray(dealData.missingDocs),
      riskLevel: getString(dealData.riskLevel) || "LOW",
      suggestions: getStringArray(dealData.suggestions),
    };

    const contractor: TenderContractorData = {
      id: contractorSnapshot.id,
      companyName:
        getString(contractorData.companyName) ||
        getString(contractorData.company) ||
        getString(contractorData.name) ||
        contractorSnapshot.id,
      registrationNumber:
        getOptionalString(contractorData.registrationNumber) ??
        getOptionalString(contractorData.companyRegistrationNumber),
      bbbeeStatus:
        getOptionalString(contractorData.bbbeeStatus) ??
        getOptionalString(contractorData.bbbeeLevel) ??
        getOptionalString(contractorData.bbbee),
      contactPerson:
        getOptionalString(contractorData.contactPerson) ??
        getOptionalString(contractorData.contactName),
      directorName:
        getOptionalString(contractorData.directorName) ??
        getOptionalString(contractorData.contactPerson) ??
        getOptionalString(contractorData.contactName),
    };

    const summaryBytes = await generateTenderPdf(deal, contractor);
    const sbd1Bytes = await fillSbd1(contractor, deal);
    const sbd4Bytes = await fillSbd4(contractor, deal);
    const supportingDocs = await loadSupportingDocuments(dealId);

    console.log("SUMMARY:", summaryBytes?.length);
    console.log("SBD1:", sbd1Bytes?.length);
    console.log("SBD4:", sbd4Bytes?.length);
    console.log("SUPPORTING DOCS:", supportingDocs.length);

    if (!isValidPdfBytes(summaryBytes)) {
      return NextResponse.json(
        { error: "Summary PDF generation failed" },
        { status: 500 }
      );
    }

    if (!isValidPdfBytes(sbd1Bytes)) {
      return NextResponse.json(
        { error: "SBD1 generation failed" },
        { status: 500 }
      );
    }

    if (!isValidPdfBytes(sbd4Bytes)) {
      return NextResponse.json(
        { error: "SBD4 generation failed" },
        { status: 500 }
      );
    }

    let finalPdf: Uint8Array;

    try {
      finalPdf = await mergeTenderPack(summaryBytes, sbd1Bytes, sbd4Bytes, supportingDocs);
    } catch (mergeError) {
      console.error("TENDER MERGE ERROR:", mergeError);
      return NextResponse.json(
        { error: "Failed to merge tender pack" },
        { status: 500 }
      );
    }

    if (!isValidPdfBytes(finalPdf)) {
      return NextResponse.json(
        { error: "Merged tender pack is invalid" },
        { status: 500 }
      );
    }

    const base64 = Buffer.from(finalPdf).toString("base64");

    return NextResponse.json({
      success: true,
      base64,
      fileName: "tender-pack.pdf",
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("TENDER PACK ERROR:", error);

    return NextResponse.json(
      { error: "Failed to generate tender pack" },
      { status: 500 }
    );
  }
}
