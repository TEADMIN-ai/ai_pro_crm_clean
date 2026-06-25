import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, deleteQsRecord, getQsRecord, listQsRecords, updateQsRecord } from "@/lib/qs/firestore";
import type { MaterialCategory, QsCreateInput, QsUpdateInput } from "@/types/qs";

export function listMaterialCategories(limit?: number) {
  return listQsRecords<MaterialCategory>(QS_COLLECTIONS.materialCategories, { limit });
}

export function getMaterialCategory(categoryId: string) {
  return getQsRecord<MaterialCategory>(QS_COLLECTIONS.materialCategories, categoryId);
}

export function createMaterialCategory(payload: QsCreateInput<MaterialCategory>) {
  return createQsRecord<MaterialCategory>(QS_COLLECTIONS.materialCategories, "categoryId", payload);
}

export function updateMaterialCategory(categoryId: string, updates: QsUpdateInput<MaterialCategory>) {
  return updateQsRecord<MaterialCategory>(QS_COLLECTIONS.materialCategories, categoryId, updates);
}

export function deleteMaterialCategory(categoryId: string) {
  return deleteQsRecord(QS_COLLECTIONS.materialCategories, categoryId);
}
