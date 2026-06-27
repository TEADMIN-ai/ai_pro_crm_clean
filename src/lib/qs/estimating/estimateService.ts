import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, getQsRecord, listQsRecords, qsCollection, updateQsRecord } from "@/lib/qs/firestore";
import type {
  Material,
  MaterialPrice,
  PriceHistory,
  QsBoqConfidence,
  QsBoqDocument,
  QsBoqLineItem,
  QSCostBreakdown,
  QSEstimate,
  QSEstimateHistory,
  QSEstimateLine,
  QSAllowanceConfig,
  QSProfitConfig,
  QSQuoteReadinessStatus,
  QSRiskConfig,
  QsUpdateInput,
  SupplierPrice,
} from "@/types/qs";

export type QSEstimateConfig = QSAllowanceConfig & QSProfitConfig & QSRiskConfig;

export const DEFAULT_QS_ESTIMATE_CONFIG: QSEstimateConfig = {
  vatRate: 0.15,
  vatEnabled: true,
  overheadPercentage: 0.12,
  profitPercentage: 0.15,
  riskPercentage: 0.05,
  lowConfidenceRiskPercentage: 0.08,
  missingPricingRiskPercentage: 0.12,
  waste: { mode: "percentage", value: 0.05 },
  transport: { mode: "percentage", value: 0.03 },
  plant: { mode: "percentage", value: 0.02 },
  labourRates: {
    General: { ratePerHour: 185, hoursPerUnit: 0.4 },
    Earthworks: { ratePerHour: 210, hoursPerUnit: 0.55 },
    Concrete: { ratePerHour: 225, hoursPerUnit: 0.65 },
    Brickwork: { ratePerHour: 215, hoursPerUnit: 0.7 },
    Steel: { ratePerHour: 260, hoursPerUnit: 0.5 },
    Roofing: { ratePerHour: 245, hoursPerUnit: 0.6 },
    Doors: { ratePerHour: 220, hoursPerUnit: 0.45 },
    Windows: { ratePerHour: 220, hoursPerUnit: 0.45 },
    Electrical: { ratePerHour: 285, hoursPerUnit: 0.5 },
    Lighting: { ratePerHour: 275, hoursPerUnit: 0.35 },
    Plumbing: { ratePerHour: 275, hoursPerUnit: 0.55 },
    Sanitary: { ratePerHour: 250, hoursPerUnit: 0.45 },
    Painting: { ratePerHour: 190, hoursPerUnit: 0.35 },
    Flooring: { ratePerHour: 220, hoursPerUnit: 0.5 },
    Ceilings: { ratePerHour: 225, hoursPerUnit: 0.5 },
    Drywall: { ratePerHour: 225, hoursPerUnit: 0.5 },
    "External Works": { ratePerHour: 220, hoursPerUnit: 0.55 },
    Civil: { ratePerHour: 235, hoursPerUnit: 0.6 },
    Landscaping: { ratePerHour: 185, hoursPerUnit: 0.45 },
    Other: { ratePerHour: 200, hoursPerUnit: 0.45 },
  },
};

type PricingLookup = {
  materialUnitCost: number | null;
  pricingSource: QSEstimateLine["pricingSource"];
  matchedMaterialIds: string[];
  warnings: string[];
};

type CalculateEstimateArgs = {
  estimateId: string;
  sourceBoq: QsBoqDocument;
  lineItems: QsBoqLineItem[];
  materials: Material[];
  materialPrices?: MaterialPrice[];
  supplierPrices?: SupplierPrice[];
  priceHistory?: PriceHistory[];
  config?: Partial<QSEstimateConfig>;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdByUid?: string | null;
  updatedByUid?: string | null;
};

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mergeEstimateConfig(config?: Partial<QSEstimateConfig>): QSEstimateConfig {
  return {
    ...DEFAULT_QS_ESTIMATE_CONFIG,
    ...config,
    waste: { ...DEFAULT_QS_ESTIMATE_CONFIG.waste, ...config?.waste },
    transport: { ...DEFAULT_QS_ESTIMATE_CONFIG.transport, ...config?.transport },
    plant: { ...DEFAULT_QS_ESTIMATE_CONFIG.plant, ...config?.plant },
    labourRates: {
      ...DEFAULT_QS_ESTIMATE_CONFIG.labourRates,
      ...config?.labourRates,
    },
  };
}

function confidenceToScore(confidence: QsBoqConfidence): number {
  if (confidence === "High") return 92;
  if (confidence === "Medium") return 72;
  return 42;
}

function latestByEffectiveDate<T extends { effectiveDate?: string | null }>(records: T[]): T | null {
  return records
    .filter((record) => Boolean(record.effectiveDate))
    .sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)))[0] ?? records[0] ?? null;
}

function resolvePricing(line: QsBoqLineItem, materials: Material[], materialPrices: MaterialPrice[], supplierPrices: SupplierPrice[], priceHistory: PriceHistory[]): PricingLookup {
  const materialIds = [
    line.materialMatch.materialId,
    ...line.materialMatch.suggestedMaterialIds,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const material = materials.find((candidate) => materialIds.includes(candidate.materialId)) ?? null;
  const warnings: string[] = [];

  if (!materialIds.length || line.materialMatch.unknownMaterial) {
    warnings.push("No material match is available for this BOQ line.");
  }

  if (!material) {
    warnings.push("Matched material record was not found in the Material Intelligence Centre.");
    return {
      materialUnitCost: null,
      pricingSource: "none",
      matchedMaterialIds: materialIds,
      warnings,
    };
  }

  if (typeof material.currentPrice === "number") {
    return {
      materialUnitCost: material.currentPrice,
      pricingSource: "materialCurrent",
      matchedMaterialIds: [material.materialId],
      warnings,
    };
  }

  if (typeof material.averageMarketPrice === "number") {
    return {
      materialUnitCost: material.averageMarketPrice,
      pricingSource: "materialAverage",
      matchedMaterialIds: [material.materialId],
      warnings,
    };
  }

  const materialPrice = latestByEffectiveDate(materialPrices.filter((price) => price.materialId === material.materialId && price.status === "active"));
  if (materialPrice) {
    return {
      materialUnitCost: materialPrice.price,
      pricingSource: materialPrice.source,
      matchedMaterialIds: [material.materialId],
      warnings,
    };
  }

  const supplierPrice = latestByEffectiveDate(supplierPrices.filter((price) => price.materialId === material.materialId && price.status === "active"));
  if (supplierPrice) {
    return {
      materialUnitCost: supplierPrice.price,
      pricingSource: supplierPrice.source,
      matchedMaterialIds: [material.materialId],
      warnings,
    };
  }

  const historicPrice = latestByEffectiveDate(priceHistory.filter((price) => price.materialId === material.materialId));
  if (historicPrice) {
    return {
      materialUnitCost: historicPrice.price,
      pricingSource: historicPrice.source,
      matchedMaterialIds: [material.materialId],
      warnings: [...warnings, "Using historical price because no current material price is available."],
    };
  }

  return {
    materialUnitCost: null,
    pricingSource: "none",
    matchedMaterialIds: [material.materialId],
    warnings: [...warnings, "Material exists but has no current, supplier, or historical price."],
  };
}

function allowance(mode: "percentage" | "fixed", value: number, base: number): number {
  return mode === "fixed" ? value : base * value;
}

function sumBreakdown(lines: QSEstimateLine[]): QSCostBreakdown {
  const breakdown = lines.reduce<QSCostBreakdown>(
    (total, line) => ({
      materialCost: total.materialCost + line.materialTotal,
      labourCost: total.labourCost + line.labourTotal,
      plantAllowance: total.plantAllowance + line.plantEquipmentCost,
      transportAllowance: total.transportAllowance + line.transportAllowance,
      wasteAllowance: total.wasteAllowance + line.wasteAllowance,
      overhead: total.overhead + line.overheadAmount,
      profit: total.profit + line.profitAmount,
      riskAllowance: total.riskAllowance + line.riskAmount,
      subtotalExVat: total.subtotalExVat + line.lineSubtotal,
      vatAmount: total.vatAmount + line.vatAmount,
      totalInclVat: total.totalInclVat + line.lineTotal,
    }),
    {
      materialCost: 0,
      labourCost: 0,
      plantAllowance: 0,
      transportAllowance: 0,
      wasteAllowance: 0,
      overhead: 0,
      profit: 0,
      riskAllowance: 0,
      subtotalExVat: 0,
      vatAmount: 0,
      totalInclVat: 0,
    },
  );

  return Object.fromEntries(Object.entries(breakdown).map(([key, value]) => [key, roundMoney(value)])) as QSCostBreakdown;
}

function readinessStatus(lines: QSEstimateLine[], confidenceScore: number): QSQuoteReadinessStatus {
  if (!lines.length) return "blocked";
  if (lines.some((line) => line.pricingSource === "none")) return "pricingIncomplete";
  if (confidenceScore < 75 || lines.some((line) => line.warnings.length > 0)) return "reviewRequired";
  return "quoteReady";
}

export function calculateQSEstimate(args: CalculateEstimateArgs): QSEstimate {
  const config = mergeEstimateConfig(args.config);
  const materials = args.materials;
  const materialPrices = args.materialPrices ?? [];
  const supplierPrices = args.supplierPrices ?? [];
  const priceHistory = args.priceHistory ?? [];

  const lines = args.lineItems.map<QSEstimateLine>((line) => {
    const quantity = typeof line.quantity === "number" && line.quantity > 0 ? line.quantity : 0;
    const pricing = resolvePricing(line, materials, materialPrices, supplierPrices, priceHistory);
    const materialUnitCost = pricing.materialUnitCost;
    const materialTotal = roundMoney(quantity * (materialUnitCost ?? 0));
    const labourConfig = config.labourRates[line.trade] ?? config.labourRates.Other ?? { ratePerHour: 200, hoursPerUnit: 0.45 };
    const labourHours = roundMoney(quantity * labourConfig.hoursPerUnit);
    const labourTotal = roundMoney(labourHours * labourConfig.ratePerHour);
    const directCost = materialTotal + labourTotal;
    const plantEquipmentCost = roundMoney(allowance(config.plant.mode, config.plant.value, directCost));
    const transportAllowance = roundMoney(allowance(config.transport.mode, config.transport.value, directCost));
    const wasteAllowance = roundMoney(allowance(config.waste.mode, config.waste.value, materialTotal));
    const overheadAmount = roundMoney((directCost + plantEquipmentCost + transportAllowance + wasteAllowance) * config.overheadPercentage);
    const riskPercentage = pricing.pricingSource === "none"
      ? config.missingPricingRiskPercentage
      : line.confidenceScore === "Low" || line.materialMatch.matchConfidence === "Low"
        ? config.lowConfidenceRiskPercentage
        : config.riskPercentage;
    const riskAmount = roundMoney((directCost + plantEquipmentCost + transportAllowance + wasteAllowance + overheadAmount) * riskPercentage);
    const profitAmount = roundMoney((directCost + plantEquipmentCost + transportAllowance + wasteAllowance + overheadAmount + riskAmount) * config.profitPercentage);
    const lineSubtotal = roundMoney(directCost + plantEquipmentCost + transportAllowance + wasteAllowance + overheadAmount + riskAmount + profitAmount);
    const vatAmount = roundMoney(config.vatEnabled ? lineSubtotal * config.vatRate : 0);
    const lineTotal = roundMoney(lineSubtotal + vatAmount);
    const warnings = [...pricing.warnings];

    if (quantity <= 0) warnings.push("BOQ quantity is missing or zero; line has no material quantity basis.");
    if (line.confidenceScore === "Low") warnings.push("BOQ extraction confidence is low.");
    if (line.materialMatch.matchConfidence === "Low") warnings.push("Material match confidence is low.");

    const confidenceScore = roundScore(
      confidenceToScore(line.confidenceScore)
      - (line.materialMatch.matchConfidence === "Low" ? 20 : line.materialMatch.matchConfidence === "Medium" ? 8 : 0)
      - (pricing.pricingSource === "none" ? 35 : 0)
      - (quantity <= 0 ? 15 : 0),
    );

    return {
      estimateLineId: `${args.estimateId}-${line.boqLineItemId}`,
      boqLineItemId: line.boqLineItemId,
      boqDocumentId: line.boqDocumentId,
      description: line.description,
      trade: line.trade,
      unit: line.normalizedUnit ?? line.unit ?? null,
      quantity,
      matchedMaterialIds: pricing.matchedMaterialIds,
      materialUnitCost,
      materialTotal,
      labourRate: labourConfig.ratePerHour,
      labourHours,
      labourTotal,
      plantEquipmentCost,
      transportAllowance,
      wasteAllowance,
      overheadAmount,
      profitAmount,
      riskAmount,
      lineSubtotal,
      vatAmount,
      lineTotal,
      confidenceScore,
      warnings,
      pricingSource: pricing.pricingSource,
    };
  });

  const breakdown = sumBreakdown(lines);
  const confidenceScore = roundScore(lines.length ? lines.reduce((total, line) => total + line.confidenceScore, 0) / lines.length : 0);
  const missingPricingWarnings = lines.flatMap((line) => line.warnings.map((warning) => `${line.description}: ${warning}`));
  const status = readinessStatus(lines, confidenceScore);

  return {
    estimateId: args.estimateId,
    sourceBoqId: args.sourceBoq.boqDocumentId,
    projectId: args.sourceBoq.projectId ?? null,
    projectName: args.sourceBoq.projectName ?? null,
    status,
    version: args.version,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
    createdByUid: args.createdByUid ?? null,
    updatedByUid: args.updatedByUid ?? null,
    createdBy: args.createdByUid ?? null,
    updatedBy: args.updatedByUid ?? null,
    assumptions: config,
    lines,
    breakdown,
    totalEstimatedProjectValue: breakdown.totalInclVat,
    confidenceScore,
    missingPricingWarnings,
    quoteReadinessStatus: status,
    sourceItemCount: args.lineItems.length,
  };
}

async function listBoqItemsForEstimate(boqDocumentId: string): Promise<QsBoqLineItem[]> {
  const snapshot = await qsCollection(QS_COLLECTIONS.boqLineItems).where("boqDocumentId", "==", boqDocumentId).limit(500).get();
  return snapshot.docs.map((doc) => ({ boqLineItemId: doc.id, ...doc.data() }) as QsBoqLineItem);
}

async function loadEstimateSourceData(boqDocumentId: string) {
  const [sourceBoq, lineItems, materials, materialPrices, supplierPrices, priceHistory] = await Promise.all([
    getQsRecord<QsBoqDocument>(QS_COLLECTIONS.boqDocuments, boqDocumentId),
    listBoqItemsForEstimate(boqDocumentId),
    listQsRecords<Material>(QS_COLLECTIONS.materials, { limit: 500 }),
    listQsRecords<MaterialPrice>(QS_COLLECTIONS.materialPrices, { limit: 500 }),
    listQsRecords<SupplierPrice>(QS_COLLECTIONS.supplierPrices, { limit: 500 }),
    listQsRecords<PriceHistory>(QS_COLLECTIONS.priceHistory, { limit: 500 }),
  ]);

  if (!sourceBoq) {
    throw new Error(`BOQ document not found: ${boqDocumentId}`);
  }

  return { sourceBoq, lineItems, materials, materialPrices, supplierPrices, priceHistory };
}

async function recordEstimateHistory(estimate: QSEstimate, reason: QSEstimateHistory["reason"], createdByUid?: string | null) {
  await createQsRecord<QSEstimateHistory>(QS_COLLECTIONS.qsEstimateHistory, "estimateHistoryId", {
    estimateHistoryId: `${estimate.estimateId}-v${estimate.version}-${reason}`,
    estimateId: estimate.estimateId,
    sourceBoqId: estimate.sourceBoqId,
    version: estimate.version,
    snapshot: estimate,
    createdByUid: createdByUid ?? null,
    reason,
    createdBy: createdByUid ?? null,
    updatedBy: createdByUid ?? null,
  });
}

export async function createEstimateFromBoq(args: {
  boqDocumentId: string;
  createdByUid?: string | null;
  config?: Partial<QSEstimateConfig>;
}): Promise<QSEstimate> {
  const existing = await findEstimateByBoq(args.boqDocumentId);
  if (existing) {
    return recalculateEstimate(existing.estimateId, args.createdByUid ?? existing.createdByUid);
  }

  const sourceData = await loadEstimateSourceData(args.boqDocumentId);
  const timestamp = new Date().toISOString();
  const estimateId = `qse-${Date.now()}`;
  const estimate = calculateQSEstimate({
    estimateId,
    sourceBoq: sourceData.sourceBoq,
    lineItems: sourceData.lineItems,
    materials: sourceData.materials,
    materialPrices: sourceData.materialPrices,
    supplierPrices: sourceData.supplierPrices,
    priceHistory: sourceData.priceHistory,
    config: args.config,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByUid: args.createdByUid ?? null,
    updatedByUid: args.createdByUid ?? null,
  });

  const created = await createQsRecord<QSEstimate>(QS_COLLECTIONS.qsEstimates, "estimateId", estimate);
  await recordEstimateHistory(created, "created", args.createdByUid ?? null);
  return created;
}

export function listEstimates(limit = 100) {
  return listQsRecords<QSEstimate>(QS_COLLECTIONS.qsEstimates, { limit });
}

export function getEstimate(estimateId: string) {
  return getQsRecord<QSEstimate>(QS_COLLECTIONS.qsEstimates, estimateId);
}

export async function findEstimateByBoq(boqDocumentId: string): Promise<QSEstimate | null> {
  const snapshot = await qsCollection(QS_COLLECTIONS.qsEstimates).where("sourceBoqId", "==", boqDocumentId).limit(1).get();
  const doc = snapshot.docs[0];
  return doc ? ({ estimateId: doc.id, ...doc.data() } as QSEstimate) : null;
}

export async function updateEstimateConfig(
  estimateId: string,
  updates: Partial<QSEstimateConfig>,
  updatedByUid?: string | null,
): Promise<QSEstimate> {
  const existing = await getEstimate(estimateId);
  if (!existing) {
    throw new Error(`QS estimate not found: ${estimateId}`);
  }

  const sourceData = await loadEstimateSourceData(existing.sourceBoqId);
  const timestamp = new Date().toISOString();
  const estimate = calculateQSEstimate({
    estimateId,
    sourceBoq: sourceData.sourceBoq,
    lineItems: sourceData.lineItems,
    materials: sourceData.materials,
    materialPrices: sourceData.materialPrices,
    supplierPrices: sourceData.supplierPrices,
    priceHistory: sourceData.priceHistory,
    config: mergeEstimateConfig({ ...existing.assumptions, ...updates }),
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: timestamp,
    createdByUid: existing.createdByUid,
    updatedByUid: updatedByUid ?? null,
  });

  const updated = await updateQsRecord<QSEstimate>(QS_COLLECTIONS.qsEstimates, estimateId, estimate as QsUpdateInput<QSEstimate>);
  await recordEstimateHistory(updated, "configUpdated", updatedByUid ?? null);
  return updated;
}

export async function recalculateEstimate(estimateId: string, updatedByUid?: string | null): Promise<QSEstimate> {
  const existing = await getEstimate(estimateId);
  if (!existing) {
    throw new Error(`QS estimate not found: ${estimateId}`);
  }

  const sourceData = await loadEstimateSourceData(existing.sourceBoqId);
  const timestamp = new Date().toISOString();
  const estimate = calculateQSEstimate({
    estimateId,
    sourceBoq: sourceData.sourceBoq,
    lineItems: sourceData.lineItems,
    materials: sourceData.materials,
    materialPrices: sourceData.materialPrices,
    supplierPrices: sourceData.supplierPrices,
    priceHistory: sourceData.priceHistory,
    config: existing.assumptions,
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: timestamp,
    createdByUid: existing.createdByUid,
    updatedByUid: updatedByUid ?? null,
  });

  const updated = await updateQsRecord<QSEstimate>(QS_COLLECTIONS.qsEstimates, estimateId, estimate as QsUpdateInput<QSEstimate>);
  await recordEstimateHistory(updated, "recalculated", updatedByUid ?? null);
  return updated;
}

export async function listEstimateHistory(estimateId: string): Promise<QSEstimateHistory[]> {
  const snapshot = await qsCollection(QS_COLLECTIONS.qsEstimateHistory).where("estimateId", "==", estimateId).limit(50).get();
  return snapshot.docs.map((doc) => ({ estimateHistoryId: doc.id, ...doc.data() }) as QSEstimateHistory);
}
