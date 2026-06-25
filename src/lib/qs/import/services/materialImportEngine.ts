import { buildSearchKeywords, normalizeSearchToken } from "@/lib/qs/firestore";
import { createMaterial } from "@/lib/qs/materials";
import { createPriceHistory } from "@/lib/qs/pricing";
import type {
  Material,
  PriceHistory,
  QsDuplicateStrategy,
  QsImportProfile,
  QsImportSourceType,
  QsMaterialImport,
  QsParsedImportRow,
  QsProvince,
} from "@/types/qs";
import { mapMaterialImportRow } from "../mappers";
import { csvImportParser, detectImportFileType, jsonImportParser, xlsxImportParser } from "../parsers";
import { validateMaterialImportRow } from "../validators";
import { createFailedImport, createImportLog, createMaterialImportRecord } from "./importAuditService";

type ExecuteMaterialImportArgs = {
  fileName: string;
  buffer: Buffer;
  importedBy?: string | null;
  sourceType: QsImportSourceType;
  profile?: QsImportProfile | null;
  duplicateStrategy?: QsDuplicateStrategy;
  dryRun?: boolean;
};

type ImportCounters = {
  rowsImported: number;
  rowsFailed: number;
  duplicateCount: number;
  updatedMaterials: number;
  newMaterials: number;
};

function parserFor(fileName: string) {
  const fileType = detectImportFileType(fileName);
  switch (fileType) {
    case "csv":
      return csvImportParser;
    case "xlsx":
      return xlsxImportParser;
    case "json":
      return jsonImportParser;
    default:
      throw new Error(`Unsupported import type: ${fileType}`);
  }
}

function slugId(value: string) {
  return normalizeSearchToken(value).replace(/\s+/g, "-").slice(0, 120);
}

const QS_PROVINCES: QsProvince[] = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
  "National",
];

function normalizeProvince(value?: string | null): QsProvince {
  const normalized = value?.trim().toLowerCase();
  return QS_PROVINCES.find((province) => province.toLowerCase() === normalized) ?? "National";
}

function materialFromRow(row: ReturnType<typeof mapMaterialImportRow>): Omit<Material, "createdAt" | "updatedAt"> {
  const materialName = row.materialName ?? "Unnamed Material";
  const materialId = row.sku?.trim() || row.barcode?.trim() || slugId(materialName);
  const supplierIds = row.supplierId ? [row.supplierId] : [];

  return {
    materialId,
    sku: row.sku ?? null,
    barcode: row.barcode ?? null,
    name: materialName,
    normalizedName: normalizeSearchToken(materialName),
    description: row.description ?? null,
    categoryId: row.categoryId ?? "pending-category-review",
    subcategory: row.subcategory ?? null,
    brandId: row.brandId ?? null,
    unit: row.normalizedUnit ?? row.unit ?? "Each",
    vatApplicable: row.vatApplicable ?? true,
    defaultSupplier: row.supplierId ?? null,
    averageMarketPrice: row.price ?? null,
    preferredSupplier: row.supplierId ?? null,
    currentPrice: row.price ?? null,
    status: "active",
    tags: [row.categoryName, row.subcategory, row.brandName].filter((value): value is string => Boolean(value)),
    searchKeywords: buildSearchKeywords(materialName, row.sku, row.barcode, row.categoryName, row.supplierName, row.brandName),
    supplierIds,
    aiExtraction: {
      sourceText: row.materialName ?? null,
      normalizedName: normalizeSearchToken(materialName),
      aliases: [],
      confidence: null,
      lastMatchedAt: null,
    },
    learning: {
      previousQuoteIds: [],
      historicalCostIds: [],
      supplierPerformanceIds: [],
      projectSimilarityKeys: [],
      inflationBaselinePriceHistoryId: null,
    },
  };
}

function priceHistoryFromRow(
  row: ReturnType<typeof mapMaterialImportRow>,
  materialId: string,
  importId: string,
  importedBy?: string | null,
): Omit<PriceHistory, "createdAt" | "updatedAt"> | null {
  if (typeof row.price !== "number") {
    return null;
  }

  const capturedDate = new Date().toISOString();
  return {
    priceHistoryId: `${importId}-${row.rowNumber}`,
    materialId,
    supplierId: row.supplierId ?? null,
    province: normalizeProvince(row.province),
    price: row.price,
    currency: "ZAR",
    effectiveDate: capturedDate,
    capturedDate,
    source: "import",
    createdBy: importedBy ?? null,
    aiExtraction: {
      sourceText: row.materialName ?? null,
      normalizedName: row.materialName ? normalizeSearchToken(row.materialName) : null,
      aliases: [],
      confidence: null,
      lastMatchedAt: null,
    },
    learning: {
      previousQuoteIds: [],
      historicalCostIds: [],
      supplierPerformanceIds: [],
      projectSimilarityKeys: [],
      inflationBaselinePriceHistoryId: null,
    },
  };
}

async function processRows(
  rows: QsParsedImportRow[],
  importRecord: QsMaterialImport,
  args: ExecuteMaterialImportArgs,
): Promise<ImportCounters> {
  const counters: ImportCounters = {
    rowsImported: 0,
    rowsFailed: 0,
    duplicateCount: 0,
    updatedMaterials: 0,
    newMaterials: 0,
  };
  const validationContext = {
    seenSkus: new Set<string>(),
    seenBarcodes: new Set<string>(),
    seenCompositeKeys: new Set<string>(),
  };

  for (const row of rows) {
    const mapped = mapMaterialImportRow(row, args.profile);
    const issues = validateMaterialImportRow(mapped, validationContext);

    if (issues.length) {
      counters.rowsFailed += 1;
      if (!args.dryRun) {
        await createFailedImport({
          failedImportId: `${importRecord.materialImportId}-${row.rowNumber}`,
          materialImportId: importRecord.materialImportId,
          rowNumber: row.rowNumber,
          rawRow: mapped.raw,
          reasons: issues.map((issue) => issue.message),
          suggestedCorrection: issues.map((issue) => issue.suggestedCorrection).filter(Boolean).join(" | ") || null,
        });
      }
      continue;
    }

    const material = materialFromRow(mapped);
    const duplicateStrategy = args.duplicateStrategy ?? args.profile?.duplicateStrategy ?? "skip";
    if (duplicateStrategy === "skip" && (mapped.sku || mapped.barcode)) {
      counters.duplicateCount += 0;
    }

    if (!args.dryRun) {
      await createMaterial(material);
      const history = priceHistoryFromRow(mapped, material.materialId, importRecord.materialImportId, args.importedBy);
      if (history) {
        await createPriceHistory(history);
      }
    }

    counters.rowsImported += 1;
    counters.newMaterials += 1;
  }

  return counters;
}

export async function executeMaterialImport(args: ExecuteMaterialImportArgs): Promise<QsMaterialImport> {
  const startedAt = Date.now();
  const parser = parserFor(args.fileName);
  const parsed = await parser.parse(args.buffer);
  const materialImportId = `import-${Date.now()}`;
  const importRecord = await createMaterialImportRecord({
    materialImportId,
    importProfileId: args.profile?.importProfileId ?? null,
    fileName: args.fileName,
    fileType: parsed.fileType,
    sourceType: args.sourceType,
    status: "processing",
    importedBy: args.importedBy ?? null,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: null,
    totalRows: parsed.rows.length,
    rowsImported: 0,
    rowsFailed: 0,
    duplicateCount: 0,
    updatedMaterials: 0,
    newMaterials: 0,
    executionTimeMs: null,
    summary: `Detected ${parsed.columns.length} columns.`,
  });

  await createImportLog({
    importLogId: `${materialImportId}-start`,
    materialImportId,
    level: "info",
    message: "Material import started.",
    metadata: { columns: parsed.columns, dryRun: args.dryRun === true },
  });

  const counters = await processRows(parsed.rows, importRecord, args);
  const completedAt = new Date().toISOString();
  const status = counters.rowsFailed > 0 ? "completedWithFailures" : "completed";

  const completedRecord = await createMaterialImportRecord({
    ...importRecord,
    status,
    completedAt,
    rowsImported: counters.rowsImported,
    rowsFailed: counters.rowsFailed,
    duplicateCount: counters.duplicateCount,
    updatedMaterials: counters.updatedMaterials,
    newMaterials: counters.newMaterials,
    executionTimeMs: Date.now() - startedAt,
    summary: `${counters.rowsImported} rows imported, ${counters.rowsFailed} rows failed.`,
  });

  await createImportLog({
    importLogId: `${materialImportId}-complete`,
    materialImportId,
    level: counters.rowsFailed > 0 ? "warning" : "info",
    message: "Material import completed.",
    metadata: counters,
  });

  return completedRecord;
}
