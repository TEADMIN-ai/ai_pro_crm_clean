import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, deleteQsRecord, getQsRecord, listQsRecords, updateQsRecord } from "@/lib/qs/firestore";
import type { MaterialPrice, QsCreateInput, QsUpdateInput } from "@/types/qs";

export function listMaterialPrices(limit?: number) {
  return listQsRecords<MaterialPrice>(QS_COLLECTIONS.materialPrices, { limit });
}

export function getMaterialPrice(materialPriceId: string) {
  return getQsRecord<MaterialPrice>(QS_COLLECTIONS.materialPrices, materialPriceId);
}

export function createMaterialPrice(payload: QsCreateInput<MaterialPrice>) {
  return createQsRecord<MaterialPrice>(QS_COLLECTIONS.materialPrices, "materialPriceId", payload);
}

export function updateMaterialPrice(materialPriceId: string, updates: QsUpdateInput<MaterialPrice>) {
  return updateQsRecord<MaterialPrice>(QS_COLLECTIONS.materialPrices, materialPriceId, updates);
}

export function deleteMaterialPrice(materialPriceId: string) {
  return deleteQsRecord(QS_COLLECTIONS.materialPrices, materialPriceId);
}
