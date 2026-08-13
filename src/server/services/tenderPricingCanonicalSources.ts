import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { TenderExtractedLineItem, TenderIntelligence } from "@/types/tenderIntelligence";
import type { TenderPricingTenderLineItem } from "@/types/tenderPricing";

export type CanonicalTenderPricingSources = {
  intelligence: TenderIntelligence | null;
  tenderLineItems: TenderPricingTenderLineItem[];
  sourcePricingDocumentId: string | null;
  sourcePricingDocumentPath: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isApprovedTenderIntelligence(intelligence: TenderIntelligence | null): intelligence is TenderIntelligence {
  return Boolean(intelligence && intelligence.analysisStatus === "APPROVED" && intelligence.reviewStatus === "APPROVED");
}

export function normalizeTenderLineDescription(description: string, itemNumber?: string | null): string {
  const trimmed = description.trim();
  const number = String(itemNumber ?? "").trim();
  if (number) {
    const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return trimmed.replace(new RegExp("^\\s*(?:" + escaped + "\\s+){1,2}", "i"), "").trim();
  }
  return trimmed.replace(/^(\d+)\s+\1\s+/, "").trim();
}

function tenderLineFromApprovedIntelligenceLine(line: TenderExtractedLineItem): TenderPricingTenderLineItem | null {
  if (line.reviewStatus !== "APPROVED") return null;
  const description = normalizeTenderLineDescription(line.description, line.itemNumber);
  return {
    id: line.id,
    itemCode: asString(line.itemNumber),
    description,
    normalizedDescription: description,
    quantity: typeof line.quantity === "number" && Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 1,
    unit: asString(line.unit) ?? "item",
    specification: line.specification,
    compulsory: line.mandatoryField !== false,
    sourcePage: line.sourcePage,
    sourceDocumentId: line.sourceDocumentId,
  };
}
function mostCommonDocumentId(documentIds: string[]): string | null {
  const counts = new Map<string, number>();
  for (const documentId of documentIds) counts.set(documentId, (counts.get(documentId) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

function resolveSourceDocumentIdFromIntelligence(intelligence: TenderIntelligence, approvedLines: TenderExtractedLineItem[]): string | null {
  const approvedLineDocumentIds = approvedLines.map((line) => line.sourceDocumentId).filter((value): value is string => Boolean(asString(value)));
  const tableDocumentIds = intelligence.pricingTables
    .filter((table) => table.falsePositiveSignals.length === 0 && (!approvedLineDocumentIds.length || approvedLineDocumentIds.includes(table.sourceDocumentId)))
    .map((table) => table.sourceDocumentId)
    .filter((value): value is string => Boolean(asString(value)));
  return mostCommonDocumentId(tableDocumentIds) ?? mostCommonDocumentId(approvedLineDocumentIds);
}

async function loadDealDocumentStoragePath(dealId: string, documentId: string | null): Promise<string | null> {
  if (!documentId) return null;
  const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).collection("documents").doc(documentId).get();
  if (!snapshot.exists) return null;
  return asString((snapshot.data() ?? {}).storagePath);
}

async function loadLatestTenderIntelligenceForPricing(dealId: string): Promise<TenderIntelligence | null> {
  const snapshot = await getFirebaseAdmin()
    .collection("tenderIntelligence")
    .where("dealId", "==", dealId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...(snapshot.docs[0].data() ?? {}) } as TenderIntelligence;
}

async function loadTenderIntelligencePricingSource(dealId: string, intelligenceId: string | null): Promise<Record<string, unknown>> {
  if (!intelligenceId) return {};
  const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).collection("pricingSources").doc(intelligenceId).get();
  return snapshot.exists ? snapshot.data() ?? {} : {};
}

export async function loadCanonicalTenderPricingSources(dealId: string): Promise<CanonicalTenderPricingSources> {
  const intelligence = await loadLatestTenderIntelligenceForPricing(dealId);
  if (!isApprovedTenderIntelligence(intelligence)) return { intelligence, tenderLineItems: [], sourcePricingDocumentId: null, sourcePricingDocumentPath: null };
  const approvedLines = intelligence.extractedLineItems.filter((line) => line.reviewStatus === "APPROVED");
  const pricingSource = await loadTenderIntelligencePricingSource(dealId, intelligence.id);
  const sourceDocumentId = asString(pricingSource.sourcePricingDocumentId) ?? resolveSourceDocumentIdFromIntelligence(intelligence, approvedLines);
  const sourcePricingDocumentPath = asString(pricingSource.sourcePricingDocumentPath) ?? await loadDealDocumentStoragePath(dealId, sourceDocumentId) ?? asString(intelligence.documentAnalyses.find((document) => document.documentId === sourceDocumentId)?.storagePath);
  return {
    intelligence,
    tenderLineItems: approvedLines.map(tenderLineFromApprovedIntelligenceLine).filter((line): line is TenderPricingTenderLineItem => Boolean(line)),
    sourcePricingDocumentId: sourceDocumentId,
    sourcePricingDocumentPath,
  };
}

export function resolveTenderIntelligenceSourceDocument(intelligence: TenderIntelligence): { id: string | null; storagePath: string | null; name: string | null } {
  const approvedLines = intelligence.extractedLineItems.filter((line) => line.reviewStatus === "APPROVED");
  const id = resolveSourceDocumentIdFromIntelligence(intelligence, approvedLines);
  const document = intelligence.documentAnalyses.find((candidate) => candidate.documentId === id);
  return { id, storagePath: document?.storagePath ?? null, name: document?.filename ?? null };
}
