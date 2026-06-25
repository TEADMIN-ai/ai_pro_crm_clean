import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, deleteQsRecord, getQsRecord, listQsRecords, updateQsRecord } from "@/lib/qs/firestore";
import type { QsCreateInput, QsUpdateInput, Supplier } from "@/types/qs";

export function listSuppliers(limit?: number) {
  return listQsRecords<Supplier>(QS_COLLECTIONS.suppliers, { limit });
}

export function getSupplier(supplierId: string) {
  return getQsRecord<Supplier>(QS_COLLECTIONS.suppliers, supplierId);
}

export function createSupplier(payload: QsCreateInput<Supplier>) {
  return createQsRecord<Supplier>(QS_COLLECTIONS.suppliers, "supplierId", payload);
}

export function updateSupplier(supplierId: string, updates: QsUpdateInput<Supplier>) {
  return updateQsRecord<Supplier>(QS_COLLECTIONS.suppliers, supplierId, updates);
}

export function deleteSupplier(supplierId: string) {
  return deleteQsRecord(QS_COLLECTIONS.suppliers, supplierId);
}
