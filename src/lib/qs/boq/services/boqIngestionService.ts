import { getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, listQsRecords, qsCollection, updateQsRecord } from "@/lib/qs/firestore";
import { extractBoqLineItems, summarizeConfidence } from "@/lib/qs/boq/extraction";
import { parseBoqDocument } from "@/lib/qs/boq/parser";
import { matchBoqMaterial } from "@/lib/qs/boq/search";
import type {
  QsBoqDocument,
  QsBoqDocumentType,
  QsBoqExtractionLog,
  QsBoqLineItem,
  QsBoqReviewQueueItem,
  QsBoqReviewStatus,
  QsBoqTradeRecord,
  QsCreateInput,
  QsUpdateInput,
} from "@/types/qs";

export type ExecuteBoqIngestionArgs = {
  fileName: string;
  mimeType?: string | null;
  buffer: Buffer;
  uploadedBy?: string | null;
  uploadedByRole?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  documentType: QsBoqDocumentType;
};

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 160);
}

async function persistBoqFile(args: ExecuteBoqIngestionArgs, boqDocumentId: string): Promise<string | null> {
  try {
    const storagePath = `qs/boq/${boqDocumentId}/${safeFileName(args.fileName)}`;
    await getFirebaseStorageBucket().file(storagePath).save(args.buffer, {
      metadata: {
        contentType: args.mimeType ?? "application/octet-stream",
        metadata: {
          uploadedBy: args.uploadedBy ?? "",
          projectId: args.projectId ?? "",
          module: "te-qs-engine",
        },
      },
      resumable: false,
    });
    return storagePath;
  } catch (error) {
    console.warn("[QS_BOQ_STORAGE_SKIPPED]", {
      fileName: args.fileName,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function executeBoqIngestion(args: ExecuteBoqIngestionArgs): Promise<QsBoqDocument> {
  const startedAt = Date.now();
  const boqDocumentId = `boq-${Date.now()}`;
  const storagePath = await persistBoqFile(args, boqDocumentId);
  const parsed = await parseBoqDocument(args);
  const extractedItems = extractBoqLineItems(parsed.text);
  const matchedItems: QsCreateInput<QsBoqLineItem>[] = [];

  for (const item of extractedItems) {
    const materialMatch = await matchBoqMaterial(item.description, item.normalizedUnit);
    const confidenceScore = item.confidenceScore === "Low" || materialMatch.matchConfidence === "Low" ? "Low" : item.confidenceScore;

    matchedItems.push({
      ...item,
      boqLineItemId: `${boqDocumentId}-line-${item.lineNumber}`,
      boqDocumentId,
      materialMatch,
      confidenceScore,
      status: confidenceScore === "Low" || materialMatch.unknownMaterial ? "pending" : item.status,
      createdBy: args.uploadedBy ?? null,
      updatedBy: args.uploadedBy ?? null,
    });
  }

  const confidenceDistribution = summarizeConfidence(matchedItems);
  const documentRecord = await createQsRecord<QsBoqDocument>(QS_COLLECTIONS.boqDocuments, "boqDocumentId", {
    boqDocumentId,
    projectId: args.projectId ?? null,
    projectName: args.projectName ?? null,
    documentType: args.documentType,
    fileName: args.fileName,
    fileType: parsed.fileType,
    mimeType: args.mimeType ?? null,
    storagePath,
    uploadedBy: args.uploadedBy ?? null,
    uploadedByRole: args.uploadedByRole ?? null,
    extractionSource: parsed.extractionSource,
    ocrUsed: parsed.ocrUsed,
    parserUsed: parsed.parserUsed,
    originalTextPreview: parsed.text.slice(0, 2000),
    textLength: parsed.text.length,
    itemCount: matchedItems.length,
    reviewStatus: matchedItems.some((item) => item.status === "pending") ? "pending" : "accepted",
    confidenceDistribution,
    extractionTimeMs: Date.now() - startedAt,
    createdBy: args.uploadedBy ?? null,
    updatedBy: args.uploadedBy ?? null,
  });

  await Promise.all(
    matchedItems.map(async (item) => {
      await createQsRecord<QsBoqLineItem>(QS_COLLECTIONS.boqLineItems, "boqLineItemId", item);
      if (item.status === "pending") {
        await createQsRecord<QsBoqReviewQueueItem>(QS_COLLECTIONS.boqReviewQueue, "boqReviewQueueId", {
          boqReviewQueueId: `${item.boqLineItemId}-review`,
          boqDocumentId,
          boqLineItemId: item.boqLineItemId,
          reason: item.materialMatch.unknownMaterial ? "Unknown material or low material-match confidence." : "Low extraction confidence.",
          originalText: item.originalText,
          suggestedAction: item.materialMatch.unknownMaterial ? "rematch" : "edit",
          status: "pending",
          createdBy: args.uploadedBy ?? null,
          updatedBy: args.uploadedBy ?? null,
        });
      }
    }),
  );

  await createQsRecord<QsBoqExtractionLog>(QS_COLLECTIONS.boqExtractionLogs, "boqExtractionLogId", {
    boqExtractionLogId: `${boqDocumentId}-log`,
    boqDocumentId,
    uploadedBy: args.uploadedBy ?? null,
    extractionTimeMs: documentRecord.extractionTimeMs,
    ocrUsed: parsed.ocrUsed,
    parserUsed: parsed.parserUsed,
    itemsExtracted: matchedItems.length,
    confidenceDistribution,
    reviewStatus: documentRecord.reviewStatus,
    message: `BOQ extraction completed with ${matchedItems.length} line items.`,
    createdBy: args.uploadedBy ?? null,
    updatedBy: args.uploadedBy ?? null,
  });

  return documentRecord;
}

export function listBoqDocuments(limit = 50) {
  return listQsRecords<QsBoqDocument>(QS_COLLECTIONS.boqDocuments, { limit });
}

export function listBoqLineItems(limit = 100) {
  return listQsRecords<QsBoqLineItem>(QS_COLLECTIONS.boqLineItems, { limit });
}

export function listBoqExtractionLogs(limit = 50) {
  return listQsRecords<QsBoqExtractionLog>(QS_COLLECTIONS.boqExtractionLogs, { limit });
}

export function listBoqReviewQueue(limit = 100) {
  return listQsRecords<QsBoqReviewQueueItem>(QS_COLLECTIONS.boqReviewQueue, { limit });
}

export function createBoqTrade(payload: QsCreateInput<QsBoqTradeRecord>) {
  return createQsRecord<QsBoqTradeRecord>(QS_COLLECTIONS.boqTrades, "boqTradeId", payload);
}

export async function updateBoqReviewItem(
  reviewQueueId: string,
  updates: QsUpdateInput<QsBoqReviewQueueItem> & { lineItemStatus?: QsBoqReviewStatus },
) {
  const { lineItemStatus, ...reviewUpdates } = updates;
  const updated = await updateQsRecord<QsBoqReviewQueueItem>(QS_COLLECTIONS.boqReviewQueue, reviewQueueId, reviewUpdates);
  if (lineItemStatus) {
    await updateQsRecord<QsBoqLineItem>(QS_COLLECTIONS.boqLineItems, updated.boqLineItemId, {
      status: lineItemStatus,
      updatedBy: updates.updatedBy,
    });
  }
  return updated;
}

export async function listBoqDocumentItems(boqDocumentId: string): Promise<QsBoqLineItem[]> {
  const snapshot = await qsCollection(QS_COLLECTIONS.boqLineItems).where("boqDocumentId", "==", boqDocumentId).limit(300).get();
  return snapshot.docs.map((doc) => ({ boqLineItemId: doc.id, ...doc.data() }) as QsBoqLineItem);
}
