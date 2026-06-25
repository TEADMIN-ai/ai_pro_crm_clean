import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, deleteQsRecord, getQsRecord, listQsRecords, updateQsRecord } from "@/lib/qs/firestore";
import type { PriceHistory, QsCreateInput, QsUpdateInput } from "@/types/qs";

export function listPriceHistory(limit?: number) {
  return listQsRecords<PriceHistory>(QS_COLLECTIONS.priceHistory, { limit });
}

export function getPriceHistory(priceHistoryId: string) {
  return getQsRecord<PriceHistory>(QS_COLLECTIONS.priceHistory, priceHistoryId);
}

export function createPriceHistory(payload: QsCreateInput<PriceHistory>) {
  return createQsRecord<PriceHistory>(QS_COLLECTIONS.priceHistory, "priceHistoryId", payload);
}

export function updatePriceHistory(priceHistoryId: string, updates: QsUpdateInput<PriceHistory>) {
  return updateQsRecord<PriceHistory>(QS_COLLECTIONS.priceHistory, priceHistoryId, updates);
}

export function deletePriceHistory(priceHistoryId: string) {
  return deleteQsRecord(QS_COLLECTIONS.priceHistory, priceHistoryId);
}
