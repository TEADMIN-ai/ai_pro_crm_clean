import type { QsImportColumnMappings, QsImportProfile, QsMappedMaterialImportRow, QsParsedImportRow } from "@/types/qs";
import { normalizeImportedUnit } from "./unitNormalizer";

const DEFAULT_MAPPINGS: Required<QsImportColumnMappings> = {
  materialName: "name",
  sku: "sku",
  barcode: "barcode",
  description: "description",
  category: "category",
  subcategory: "subcategory",
  brand: "brand",
  unit: "unit",
  price: "price",
  currency: "currency",
  supplier: "supplier",
  vatApplicable: "vatApplicable",
  province: "province",
};

function getValue(row: QsParsedImportRow, column?: string | null) {
  if (!column) {
    return null;
  }

  const direct = row.raw[column];
  if (typeof direct === "string") {
    return direct.trim() || null;
  }

  const normalizedColumn = column.toLowerCase();
  const matchedKey = Object.keys(row.raw).find((key) => key.toLowerCase() === normalizedColumn);
  return matchedKey ? row.raw[matchedKey].trim() || null : null;
}

function parsePrice(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseVat(value: string | null): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1", "vat", "vatable"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "non-vat", "exempt"].includes(normalized)) return false;
  return null;
}

export function mapMaterialImportRow(
  row: QsParsedImportRow,
  profile?: Pick<QsImportProfile, "columnMappings" | "categoryMappings" | "supplierMappings" | "unitMappings"> | null,
): QsMappedMaterialImportRow {
  const mappings = {
    ...DEFAULT_MAPPINGS,
    ...(profile?.columnMappings ?? {}),
  };
  const categoryName = getValue(row, mappings.category);
  const supplierName = getValue(row, mappings.supplier);
  const unit = getValue(row, mappings.unit);

  return {
    rowNumber: row.rowNumber,
    materialName: getValue(row, mappings.materialName),
    sku: getValue(row, mappings.sku),
    barcode: getValue(row, mappings.barcode),
    description: getValue(row, mappings.description),
    categoryName,
    categoryId: categoryName ? profile?.categoryMappings[categoryName] ?? profile?.categoryMappings[categoryName.toLowerCase()] ?? null : null,
    subcategory: getValue(row, mappings.subcategory),
    brandName: getValue(row, mappings.brand),
    unit,
    normalizedUnit: normalizeImportedUnit(unit, profile?.unitMappings),
    price: parsePrice(getValue(row, mappings.price)),
    currency: getValue(row, mappings.currency) ?? "ZAR",
    supplierName,
    supplierId: supplierName ? profile?.supplierMappings[supplierName] ?? profile?.supplierMappings[supplierName.toLowerCase()] ?? null : null,
    province: getValue(row, mappings.province) ?? "National",
    vatApplicable: parseVat(getValue(row, mappings.vatApplicable)),
    raw: row.raw,
  };
}
