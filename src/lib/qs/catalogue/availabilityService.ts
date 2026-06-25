import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, deleteQsRecord, getQsRecord, listQsRecords, updateQsRecord } from "@/lib/qs/firestore";
import type { MaterialAvailability, QsCreateInput, QsUpdateInput } from "@/types/qs";

export function listMaterialAvailability(limit?: number) {
  return listQsRecords<MaterialAvailability>(QS_COLLECTIONS.materialAvailability, { limit });
}

export function getMaterialAvailability(availabilityId: string) {
  return getQsRecord<MaterialAvailability>(QS_COLLECTIONS.materialAvailability, availabilityId);
}

export function createMaterialAvailability(payload: QsCreateInput<MaterialAvailability>) {
  return createQsRecord<MaterialAvailability>(QS_COLLECTIONS.materialAvailability, "availabilityId", payload);
}

export function updateMaterialAvailability(availabilityId: string, updates: QsUpdateInput<MaterialAvailability>) {
  return updateQsRecord<MaterialAvailability>(QS_COLLECTIONS.materialAvailability, availabilityId, updates);
}

export function deleteMaterialAvailability(availabilityId: string) {
  return deleteQsRecord(QS_COLLECTIONS.materialAvailability, availabilityId);
}
