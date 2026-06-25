import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { normalizeSearchToken, qsCollection } from "@/lib/qs/firestore";
import type { QsBoqDocument, QsBoqLineItem, QsBoqTrade } from "@/types/qs";

export type BoqSearchCriteria = {
  project?: string;
  trade?: QsBoqTrade | "all";
  material?: string;
  document?: string;
  date?: string;
  limit?: number;
};

function includes(value: string | null | undefined, query?: string) {
  if (!query) return true;
  return normalizeSearchToken(value ?? "").includes(normalizeSearchToken(query));
}

export async function searchBoqDocuments(criteria: BoqSearchCriteria = {}): Promise<QsBoqDocument[]> {
  const limit = Math.max(1, Math.min(criteria.limit ?? 50, 100));
  const snapshot = await qsCollection(QS_COLLECTIONS.boqDocuments).limit(200).get();

  return snapshot.docs
    .map((doc) => ({ boqDocumentId: doc.id, ...doc.data() }) as QsBoqDocument)
    .filter((document) => includes(document.projectName, criteria.project))
    .filter((document) => includes(document.fileName, criteria.document))
    .filter((document) => (criteria.date ? document.createdAt.startsWith(criteria.date) : true))
    .slice(0, limit);
}

export async function searchBoqLineItems(criteria: BoqSearchCriteria = {}): Promise<QsBoqLineItem[]> {
  const limit = Math.max(1, Math.min(criteria.limit ?? 50, 100));
  const snapshot = await qsCollection(QS_COLLECTIONS.boqLineItems).limit(300).get();

  return snapshot.docs
    .map((doc) => ({ boqLineItemId: doc.id, ...doc.data() }) as QsBoqLineItem)
    .filter((item) => (criteria.trade && criteria.trade !== "all" ? item.trade === criteria.trade : true))
    .filter((item) => includes(item.description, criteria.material) || includes(item.materialMatch.materialName, criteria.material))
    .slice(0, limit);
}
