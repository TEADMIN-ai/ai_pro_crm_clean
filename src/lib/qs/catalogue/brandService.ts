import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, deleteQsRecord, getQsRecord, listQsRecords, updateQsRecord } from "@/lib/qs/firestore";
import type { Brand, QsCreateInput, QsUpdateInput } from "@/types/qs";

export function listBrands(limit?: number) {
  return listQsRecords<Brand>(QS_COLLECTIONS.brands, { limit });
}

export function getBrand(brandId: string) {
  return getQsRecord<Brand>(QS_COLLECTIONS.brands, brandId);
}

export function createBrand(payload: QsCreateInput<Brand>) {
  return createQsRecord<Brand>(QS_COLLECTIONS.brands, "brandId", payload);
}

export function updateBrand(brandId: string, updates: QsUpdateInput<Brand>) {
  return updateQsRecord<Brand>(QS_COLLECTIONS.brands, brandId, updates);
}

export function deleteBrand(brandId: string) {
  return deleteQsRecord(QS_COLLECTIONS.brands, brandId);
}
