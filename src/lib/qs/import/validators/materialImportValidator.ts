import type { QsImportValidationIssue, QsMappedMaterialImportRow } from "@/types/qs";

type ValidationContext = {
  validCategoryIds?: Set<string>;
  knownSupplierIds?: Set<string>;
  seenSkus?: Set<string>;
  seenBarcodes?: Set<string>;
  seenCompositeKeys?: Set<string>;
};

const VALID_CURRENCIES = new Set(["ZAR"]);

function issue(
  code: QsImportValidationIssue["code"],
  message: string,
  field?: string,
  suggestedCorrection?: string,
): QsImportValidationIssue {
  return { code, message, field, suggestedCorrection };
}

export function validateMaterialImportRow(
  row: QsMappedMaterialImportRow,
  context: ValidationContext = {},
): QsImportValidationIssue[] {
  const issues: QsImportValidationIssue[] = [];

  if (!row.materialName) {
    issues.push(issue("missing_material_name", "Material name is required.", "materialName", "Provide a material name."));
  }

  if (!row.normalizedUnit) {
    issues.push(issue("missing_unit", "Unit is required.", "unit", "Map the imported unit to a standard unit."));
  }

  if (typeof row.price === "number" && row.price < 0) {
    issues.push(issue("negative_price", "Price cannot be negative.", "price", "Use a zero or positive price."));
  }

  if (row.sku && context.seenSkus?.has(row.sku)) {
    issues.push(issue("duplicate_sku", `Duplicate SKU in import: ${row.sku}`, "sku", "Use skip/update/replace/merge duplicate handling."));
  }

  if (row.barcode && context.seenBarcodes?.has(row.barcode)) {
    issues.push(issue("duplicate_barcode", `Duplicate barcode in import: ${row.barcode}`, "barcode", "Use skip/update/replace/merge duplicate handling."));
  }

  const compositeKey = [
    row.materialName?.toLowerCase().trim(),
    row.supplierName?.toLowerCase().trim(),
    row.categoryName?.toLowerCase().trim(),
  ].filter(Boolean).join("|");
  if (compositeKey && context.seenCompositeKeys?.has(compositeKey)) {
    issues.push(issue("duplicate_sku", "Duplicate material/supplier/category combination in import.", "materialName", "Use skip/update/replace/merge duplicate handling."));
  }

  if (row.categoryName && !row.categoryId) {
    issues.push(issue("invalid_category", `Unknown category: ${row.categoryName}`, "category", "Map this category in an import profile."));
  } else if (row.categoryId && context.validCategoryIds && !context.validCategoryIds.has(row.categoryId)) {
    issues.push(issue("invalid_category", `Unknown category: ${row.categoryName ?? row.categoryId}`, "category", "Map this category in an import profile."));
  }

  if (row.supplierName && !row.supplierId) {
    issues.push(issue("unknown_supplier", `Unknown supplier: ${row.supplierName}`, "supplier", "Create or map the supplier before import."));
  } else if (row.supplierId && context.knownSupplierIds && !context.knownSupplierIds.has(row.supplierId)) {
    issues.push(issue("unknown_supplier", `Unknown supplier: ${row.supplierId}`, "supplier", "Create or map the supplier before import."));
  }

  if (row.vatApplicable === null && typeof row.raw.vatApplicable === "string" && row.raw.vatApplicable.trim()) {
    issues.push(issue("invalid_vat", "VAT value is not recognised.", "vatApplicable", "Use yes/no, true/false, or 1/0."));
  }

  if (row.currency && !VALID_CURRENCIES.has(String(row.currency).toUpperCase())) {
    issues.push(issue("invalid_currency", `Unsupported currency: ${row.currency}`, "currency", "Use ZAR."));
  }

  if (row.sku) context.seenSkus?.add(row.sku);
  if (row.barcode) context.seenBarcodes?.add(row.barcode);
  if (compositeKey) context.seenCompositeKeys?.add(compositeKey);

  return issues;
}
