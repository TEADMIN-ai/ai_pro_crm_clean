import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, deleteQsRecord, getQsRecord, listQsRecords, updateQsRecord } from "@/lib/qs/firestore";
import type { QsCreateInput, QsUpdateInput, SupplierPrice } from "@/types/qs";

export function listSupplierPrices(limit?: number) {
  return listQsRecords<SupplierPrice>(QS_COLLECTIONS.supplierPrices, { limit });
}

export function getSupplierPrice(supplierPriceId: string) {
  return getQsRecord<SupplierPrice>(QS_COLLECTIONS.supplierPrices, supplierPriceId);
}

export function createSupplierPrice(payload: QsCreateInput<SupplierPrice>) {
  return createQsRecord<SupplierPrice>(QS_COLLECTIONS.supplierPrices, "supplierPriceId", payload);
}

export function updateSupplierPrice(supplierPriceId: string, updates: QsUpdateInput<SupplierPrice>) {
  return updateQsRecord<SupplierPrice>(QS_COLLECTIONS.supplierPrices, supplierPriceId, updates);
}

export function deleteSupplierPrice(supplierPriceId: string) {
  return deleteQsRecord(QS_COLLECTIONS.supplierPrices, supplierPriceId);
}
