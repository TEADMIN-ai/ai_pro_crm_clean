import { QS_COLLECTIONS } from "@/lib/qs/collections";
import {
  buildSearchKeywords,
  createQsRecord,
  deleteQsRecord,
  getQsRecord,
  listQsRecords,
  normalizeSearchToken,
  updateQsRecord,
} from "@/lib/qs/firestore";
import type { Material, QsCreateInput, QsUpdateInput } from "@/types/qs";

function prepareMaterialPayload<T extends QsCreateInput<Material> | QsUpdateInput<Material>>(payload: T): T {
  const normalizedName = payload.name ? normalizeSearchToken(payload.name) : payload.normalizedName;
  const searchKeywords = buildSearchKeywords(
    payload.name,
    payload.sku,
    payload.barcode,
    payload.subcategory,
    ...(payload.tags ?? []),
  );

  return {
    ...payload,
    ...(normalizedName ? { normalizedName } : {}),
    ...(searchKeywords.length ? { searchKeywords } : {}),
  };
}

export function listMaterials(limit?: number) {
  return listQsRecords<Material>(QS_COLLECTIONS.materials, { limit });
}

export function getMaterial(materialId: string) {
  return getQsRecord<Material>(QS_COLLECTIONS.materials, materialId);
}

export function createMaterial(payload: QsCreateInput<Material>) {
  return createQsRecord<Material>(
    QS_COLLECTIONS.materials,
    "materialId",
    prepareMaterialPayload(payload),
  );
}

export function updateMaterial(materialId: string, updates: QsUpdateInput<Material>) {
  return updateQsRecord<Material>(
    QS_COLLECTIONS.materials,
    materialId,
    prepareMaterialPayload(updates),
  );
}

export function deleteMaterial(materialId: string) {
  return deleteQsRecord(QS_COLLECTIONS.materials, materialId);
}
