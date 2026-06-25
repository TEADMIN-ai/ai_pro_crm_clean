import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { normalizeSearchToken, qsCollection } from "@/lib/qs/firestore";
import type { Material } from "@/types/qs";

export type MaterialSearchCriteria = {
  materialName?: string;
  sku?: string;
  categoryId?: string;
  supplierId?: string;
  brandId?: string;
  barcode?: string;
  limit?: number;
};

function boundedLimit(limit?: number) {
  return Math.max(1, Math.min(limit ?? 25, 100));
}

export async function searchMaterials(criteria: MaterialSearchCriteria): Promise<Material[]> {
  const limit = boundedLimit(criteria.limit);
  let query: FirebaseFirestore.Query = qsCollection(QS_COLLECTIONS.materials);

  if (criteria.sku) {
    query = query.where("sku", "==", criteria.sku.trim());
  }

  if (criteria.barcode) {
    query = query.where("barcode", "==", criteria.barcode.trim());
  }

  if (criteria.categoryId) {
    query = query.where("categoryId", "==", criteria.categoryId.trim());
  }

  if (criteria.brandId) {
    query = query.where("brandId", "==", criteria.brandId.trim());
  }

  if (criteria.supplierId) {
    query = query.where("supplierIds", "array-contains", criteria.supplierId.trim());
  }

  if (criteria.materialName) {
    const token = normalizeSearchToken(criteria.materialName);
    if (token) {
      query = query.where("searchKeywords", "array-contains", token);
    }
  }

  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map((doc) => ({ materialId: doc.id, ...doc.data() }) as Material);
}

export type MaterialSearchMatchContext = {
  boqItemText?: string | null;
  extractedUnit?: string | null;
  extractedQuantity?: number | null;
  candidateMaterialIds: string[];
};
