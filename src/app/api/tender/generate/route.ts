import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { fillSbd1 } from "@/lib/empirePdf/fillSbd1";
import { fillSbd4 } from "@/lib/empirePdf/fillSbd4";
import { generateTenderPdf } from "@/lib/pdf/generateTenderPdf";
import { mergeTenderPack } from "@/lib/pdf/mergeTenderPack";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { persistTenderPackPdf } from "@/server/services/tenderPackService";
import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type TenderGenerateStageName =
  | "route_started"
  | "deal_loaded"
  | "contractor_loaded"
  | "compliance_recomputed"
  | "summary_generated"
  | "sbd1_generated"
  | "sbd4_generated"
  | "supporting_docs_loaded"
  | "pdf_merge_started"
  | "pdf_merge_completed"
  | "response_serialization_started"
  | "response_sent";

type StageTelemetryContext = {
  dealId: string | null;
  contractorId: string | null;
};

const DEFAULT_STAGE_TIMEOUT_WARNING_MS = 30_000;
const MERGE_STAGE_TIMEOUT_WARNING_MS = 60_000;
const LEGACY_DELIVERY_QUERY_VALUE = "base64";

function logStageLifecycle(params: {
  stage: TenderGenerateStageName;
  status: "started" | "completed";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  dealId: string | null;
  contractorId: string | null;
  details?: Record<string, unknown>;
}) {
  console.info("[TENDER_GENERATE_STAGE]", params);
}

function logStageTimeoutWarning(params: {
  stage: string;
  elapsedMs: number;
  dealId: string | null;
  contractorId: string | null;
  details?: Record<string, unknown>;
}) {
  console.warn("[TENDER_GENERATE_STAGE]", {
    event: "stage_timeout_warning",
    ...params,
  });
}

function logArtifactTelemetry(params: {
  event: "artifact_persist_started" | "artifact_persist_completed" | "artifact_delivery_ready";
  dealId: string | null;
  contractorId: string | null;
  fileName?: string;
  size?: number;
  artifactLocation?: string;
  downloadUrlPresent?: boolean;
  persistenceDurationMs?: number;
  expiresAt?: number;
  deliveryMode?: "artifact" | "base64";
}) {
  console.info("[TENDER_PACK_ARTIFACT]", params);
}

function createStageTracker(initialContext?: Partial<StageTelemetryContext>) {
  const stageStarts = new Map<string, number>();
  const context: StageTelemetryContext = {
    dealId: initialContext?.dealId ?? null,
    contractorId: initialContext?.contractorId ?? null,
  };

  return {
    setContext(nextContext: Partial<StageTelemetryContext>) {
      if (nextContext.dealId !== undefined) {
        context.dealId = nextContext.dealId;
      }

      if (nextContext.contractorId !== undefined) {
        context.contractorId = nextContext.contractorId;
      }
    },
    start(stage: TenderGenerateStageName, details?: Record<string, unknown>) {
      const startedAtMs = Date.now();
      stageStarts.set(stage, startedAtMs);
      logStageLifecycle({
        stage,
        status: "started",
        startedAt: new Date(startedAtMs).toISOString(),
        dealId: context.dealId,
        contractorId: context.contractorId,
        details,
      });
    },
    complete(stage: TenderGenerateStageName, details?: Record<string, unknown>) {
      const completedAtMs = Date.now();
      const startedAtMs = stageStarts.get(stage) ?? completedAtMs;
      logStageLifecycle({
        stage,
        status: "completed",
        startedAt: new Date(startedAtMs).toISOString(),
        completedAt: new Date(completedAtMs).toISOString(),
        durationMs: completedAtMs - startedAtMs,
        dealId: context.dealId,
        contractorId: context.contractorId,
        details,
      });
      stageStarts.delete(stage);
    },
    getContext() {
      return { ...context };
    },
  };
}

async function withTimeoutWarning<T>(params: {
  stage: string;
  dealId: string | null;
  contractorId: string | null;
  operation: () => Promise<T>;
  timeoutWarningMs?: number;
  details?: Record<string, unknown>;
}): Promise<T> {
  const startedAtMs = Date.now();
  const timeoutHandle = setTimeout(() => {
    logStageTimeoutWarning({
      stage: params.stage,
      elapsedMs: Date.now() - startedAtMs,
      dealId: params.dealId,
      contractorId: params.contractorId,
      details: params.details,
    });
  }, params.timeoutWarningMs ?? DEFAULT_STAGE_TIMEOUT_WARNING_MS);

  try {
    return await params.operation();
  } finally {
    clearTimeout(timeoutHandle);
  }
}

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

async function loadSupportingDocuments(params: {
  dealId: string;
  contractorId: string | null;
}): Promise<Uint8Array[]> {
  const db = getFirebaseAdmin();
  const snapshotQueryStartedAt = Date.now();
  const supportingSnapshot = await db
    .collection("documents")
    .where("dealId", "==", params.dealId)
    .where("type", "==", "supporting")
    .get();

  console.info("[TENDER_SUPPORTING_DOCS]", {
    stage: "supporting_docs_snapshot_loaded",
    startedAt: new Date(snapshotQueryStartedAt).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - snapshotQueryStartedAt,
    dealId: params.dealId,
    contractorId: params.contractorId,
    snapshotSize: supportingSnapshot.size,
  });

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
      const fetchStartedAtMs = Date.now();
      console.info("[TENDER_SUPPORTING_DOCS]", {
        stage: "supporting_doc_fetch_started",
        startedAt: new Date(fetchStartedAtMs).toISOString(),
        dealId: params.dealId,
        contractorId: params.contractorId,
        documentId: document.id,
        fileUrl: document.fileUrl,
      });

      try {
        const bytes = await withTimeoutWarning({
          stage: "supporting_doc_fetch",
          dealId: params.dealId,
          contractorId: params.contractorId,
          timeoutWarningMs: DEFAULT_STAGE_TIMEOUT_WARNING_MS,
          details: {
            documentId: document.id,
            fileUrl: document.fileUrl,
          },
          operation: () => fetchSupportingDocumentBytes(document.fileUrl),
        });
        const pdfValidationStartedAtMs = Date.now();
        await withTimeoutWarning({
          stage: "supporting_doc_pdf_validation",
          dealId: params.dealId,
          contractorId: params.contractorId,
          timeoutWarningMs: DEFAULT_STAGE_TIMEOUT_WARNING_MS,
          details: {
            documentId: document.id,
            byteLength: bytes.byteLength,
          },
          operation: () => PDFDocument.load(bytes),
        });
        console.info("[TENDER_SUPPORTING_DOCS]", {
          stage: "supporting_doc_fetch_completed",
          startedAt: new Date(fetchStartedAtMs).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - fetchStartedAtMs,
          dealId: params.dealId,
          contractorId: params.contractorId,
          documentId: document.id,
          fileUrl: document.fileUrl,
          byteLength: bytes.byteLength,
          validationDurationMs: Date.now() - pdfValidationStartedAtMs,
        });
        return bytes;
      } catch (error) {
        console.warn("SUPPORTING DOC SKIPPED:", {
          documentId: document.id,
          fileUrl: document.fileUrl,
          durationMs: Date.now() - fetchStartedAtMs,
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
    const db = getFirebaseAdmin();
    const stageTracker = createStageTracker();
    const deliveryMode = request.nextUrl.searchParams.get("delivery") === LEGACY_DELIVERY_QUERY_VALUE ? "base64" : "artifact";
    stageTracker.start("route_started", {
      method: request.method,
      url: request.url,
      deliveryMode,
    });
    const user = await requireAuthorizedUser(request);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    const body = (await request.json()) as GenerateBody;
    const dealId = getString(body.dealId);
    const contractorId = getString(body.contractorId);
    stageTracker.setContext({
      dealId: dealId || null,
      contractorId: contractorId || null,
    });
    stageTracker.complete("route_started", {
      actorRole: user.role,
      actorUid: user.uid,
      deliveryMode,
    });

    if (!dealId || !contractorId) {
      return NextResponse.json({ error: "dealId and contractorId are required" }, { status: 400 });
    }

    stageTracker.start("deal_loaded");
    const dealSnapshot = await withTimeoutWarning({
      stage: "deal_loaded",
      dealId,
      contractorId,
      operation: () => db.collection("deals").doc(dealId).get(),
    });
    stageTracker.complete("deal_loaded", {
      exists: dealSnapshot.exists,
    });
    if (!dealSnapshot.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const dealData = dealSnapshot.data() ?? {};
    const storedContractorId = getString(dealData.contractorId);

    if (!storedContractorId || storedContractorId !== contractorId) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    assertCanAccessContractor(user, contractorId);

    stageTracker.start("contractor_loaded");
    const contractorSnapshot = await withTimeoutWarning({
      stage: "contractor_loaded",
      dealId,
      contractorId,
      operation: () => db.collection("contractors").doc(contractorId).get(),
    });
    stageTracker.complete("contractor_loaded", {
      exists: contractorSnapshot.exists,
    });
    if (!contractorSnapshot.exists) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    stageTracker.start("compliance_recomputed");
    const compliance = await withTimeoutWarning({
      stage: "compliance_recomputed",
      dealId,
      contractorId,
      operation: () => recalculateContractorCompliance(db, contractorId),
    });
    stageTracker.complete("compliance_recomputed", {
      readinessScore: compliance.readinessScore,
      tenderLockStatus: compliance.tenderLockStatus,
      docsMissing: compliance.docsMissing,
      complianceApproved: compliance.complianceApproved,
    });
    const readinessScore = compliance.readinessScore;
    const unresolvedDocuments = Object.entries(compliance.legacyDocuments)
      .filter(([, value]) => value.valid !== true)
      .map(([key]) => key);

    console.log("READINESS SCORE:", readinessScore);
    if (
      compliance.complianceApproved !== true ||
      compliance.docsMissing > 0 ||
      compliance.expiredDocumentCount > 0 ||
      compliance.tenderLockStatus !== "READY"
    ) {
      return NextResponse.json(
        {
          error: "Deal not ready for tender pack generation",
          readinessScore,
          missingDocuments: unresolvedDocuments,
          tenderLockStatus: compliance.tenderLockStatus,
        },
        { status: 403 }
      );
    }

    const contractorData = contractorSnapshot.data() ?? {};

    const deal: TenderDealData = {
      id: dealSnapshot.id,
      title: getString(dealData.title) || getString(dealData.name) || dealSnapshot.id,
      value: getNumber(dealData.value),
      readinessScore,
      missingDocs: unresolvedDocuments,
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

    stageTracker.start("summary_generated");
    const summaryBytes = await withTimeoutWarning({
      stage: "summary_generated",
      dealId,
      contractorId,
      operation: () => generateTenderPdf(deal, contractor),
    });
    stageTracker.complete("summary_generated", {
      byteLength: summaryBytes.byteLength,
      pageCountEstimate: 2,
    });

    stageTracker.start("sbd1_generated");
    const sbd1Bytes = await withTimeoutWarning({
      stage: "sbd1_generated",
      dealId,
      contractorId,
      operation: () => fillSbd1(contractor, deal),
    });
    stageTracker.complete("sbd1_generated", {
      byteLength: sbd1Bytes.byteLength,
    });

    stageTracker.start("sbd4_generated");
    const sbd4Bytes = await withTimeoutWarning({
      stage: "sbd4_generated",
      dealId,
      contractorId,
      operation: () => fillSbd4(contractor, deal),
    });
    stageTracker.complete("sbd4_generated", {
      byteLength: sbd4Bytes.byteLength,
    });

    stageTracker.start("supporting_docs_loaded");
    const supportingDocs = await withTimeoutWarning({
      stage: "supporting_docs_loaded",
      dealId,
      contractorId,
      operation: () => loadSupportingDocuments({ dealId, contractorId }),
      details: {
        expectedSource: "documents.where(dealId,type=supporting)",
      },
    });
    stageTracker.complete("supporting_docs_loaded", {
      documentCount: supportingDocs.length,
      byteLengths: supportingDocs.map((document) => document.byteLength),
    });

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
      stageTracker.start("pdf_merge_started", {
        inputCount: 3 + supportingDocs.length,
        summaryBytes: summaryBytes.byteLength,
        sbd1Bytes: sbd1Bytes.byteLength,
        sbd4Bytes: sbd4Bytes.byteLength,
        supportingDocByteLengths: supportingDocs.map((document) => document.byteLength),
      });
      finalPdf = await withTimeoutWarning({
        stage: "pdf_merge_started",
        dealId,
        contractorId,
        timeoutWarningMs: MERGE_STAGE_TIMEOUT_WARNING_MS,
        details: {
          inputCount: 3 + supportingDocs.length,
          summaryBytes: summaryBytes.byteLength,
          sbd1Bytes: sbd1Bytes.byteLength,
          sbd4Bytes: sbd4Bytes.byteLength,
          supportingDocByteLengths: supportingDocs.map((document) => document.byteLength),
        },
        operation: () => mergeTenderPack(summaryBytes, sbd1Bytes, sbd4Bytes, supportingDocs),
      });
      stageTracker.complete("pdf_merge_started", {
        mergedByteLength: finalPdf.byteLength,
      });
      stageTracker.start("pdf_merge_completed", {
        mergedByteLength: finalPdf.byteLength,
      });
      stageTracker.complete("pdf_merge_completed", {
        mergedByteLength: finalPdf.byteLength,
      });
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

    const artifactPersistStartedAt = Date.now();
    logArtifactTelemetry({
      event: "artifact_persist_started",
      dealId,
      contractorId,
      size: finalPdf.byteLength,
      deliveryMode,
    });
    const persistedPack = await withTimeoutWarning({
      stage: "artifact_persist",
      dealId,
      contractorId,
      timeoutWarningMs: MERGE_STAGE_TIMEOUT_WARNING_MS,
      details: {
        byteLength: finalPdf.byteLength,
        deliveryMode,
      },
      operation: () =>
        persistTenderPackPdf({
          createdBy: user.uid,
          contractorId,
          templateKey: "tender-pack",
          pdfBytes: finalPdf,
          missingFields: unresolvedDocuments,
          warnings: [],
          fieldMapUsed: {
            dealId,
            contractorId,
          },
        }),
    });
    const artifactPersistenceDurationMs = Date.now() - artifactPersistStartedAt;
    logArtifactTelemetry({
      event: "artifact_persist_completed",
      dealId,
      contractorId,
      fileName: persistedPack.fileName,
      size: persistedPack.size,
      artifactLocation: persistedPack.storagePath,
      downloadUrlPresent: Boolean(persistedPack.downloadURL),
      persistenceDurationMs: artifactPersistenceDurationMs,
      expiresAt: persistedPack.expiresAt,
      deliveryMode,
    });

    stageTracker.start("response_serialization_started", {
      finalPdfByteLength: finalPdf.byteLength,
      deliveryMode,
    });
    const responsePayload: {
      success: true;
      packId: string;
      downloadURL: string;
      downloadUrl: string;
      fileName: string;
      size: number;
      expiresAt: number;
      deliveryMode: "artifact" | "base64";
      warnings: string[];
      missingFields: string[];
      base64?: string;
    } = {
      success: true,
      packId: persistedPack.packId,
      downloadURL: persistedPack.downloadURL,
      downloadUrl: persistedPack.downloadUrl,
      fileName: persistedPack.fileName,
      size: persistedPack.size,
      expiresAt: persistedPack.expiresAt,
      deliveryMode,
      warnings: [],
      missingFields: unresolvedDocuments,
    };

    if (deliveryMode === "base64") {
      responsePayload.base64 = await withTimeoutWarning({
        stage: "response_serialization_started",
        dealId,
        contractorId,
        timeoutWarningMs: MERGE_STAGE_TIMEOUT_WARNING_MS,
        details: {
          finalPdfByteLength: finalPdf.byteLength,
          deliveryMode,
        },
        operation: async () => Buffer.from(finalPdf).toString("base64"),
      });
    }
    stageTracker.complete("response_serialization_started", {
      finalPdfByteLength: finalPdf.byteLength,
      base64Length: responsePayload.base64?.length ?? 0,
      deliveryMode,
      persistedArtifactSize: persistedPack.size,
    });
    logArtifactTelemetry({
      event: "artifact_delivery_ready",
      dealId,
      contractorId,
      fileName: persistedPack.fileName,
      size: persistedPack.size,
      artifactLocation: persistedPack.storagePath,
      downloadUrlPresent: Boolean(persistedPack.downloadURL),
      expiresAt: persistedPack.expiresAt,
      deliveryMode,
    });
    stageTracker.start("response_sent", {
      responseBodyKeys: Object.keys(responsePayload),
    });
    stageTracker.complete("response_sent", {
      finalPdfByteLength: finalPdf.byteLength,
      base64Length: responsePayload.base64?.length ?? 0,
      deliveryMode,
    });

    return NextResponse.json(responsePayload);
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
