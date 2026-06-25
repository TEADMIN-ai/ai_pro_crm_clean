import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, deleteQsRecord, getQsRecord, listQsRecords, updateQsRecord } from "@/lib/qs/firestore";
import type { QsCreateInput, QsUpdateInput, UnitOfMeasure } from "@/types/qs";

export function listUnitMeasurements(limit?: number) {
  return listQsRecords<UnitOfMeasure>(QS_COLLECTIONS.unitMeasurements, { limit });
}

export function getUnitMeasurement(unitId: string) {
  return getQsRecord<UnitOfMeasure>(QS_COLLECTIONS.unitMeasurements, unitId);
}

export function createUnitMeasurement(payload: QsCreateInput<UnitOfMeasure>) {
  return createQsRecord<UnitOfMeasure>(QS_COLLECTIONS.unitMeasurements, "unitId", payload);
}

export function updateUnitMeasurement(unitId: string, updates: QsUpdateInput<UnitOfMeasure>) {
  return updateQsRecord<UnitOfMeasure>(QS_COLLECTIONS.unitMeasurements, unitId, updates);
}

export function deleteUnitMeasurement(unitId: string) {
  return deleteQsRecord(QS_COLLECTIONS.unitMeasurements, unitId);
}
