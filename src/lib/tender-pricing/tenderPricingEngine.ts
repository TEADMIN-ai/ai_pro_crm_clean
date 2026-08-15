import type { SupplierQuote, SupplierQuoteLineItem } from "@/types/supplierQuote";
import type {
  TenderLineMapping,
  TenderPricingBlocker,
  TenderPricingBuildInput,
  TenderPricingDocumentFillEvidence,
  TenderPricingHandoff,
  TenderPricingLineItem,
  TenderPricingRiskCode,
  TenderPricingRules,
  TenderPricingSource,
  TenderPricingSourceValidationInput,
  TenderPricingStatus,
  TenderPricingTenderLineItem,
  TenderPricingWorkspace,
  TenderSupplierOption,
} from "@/types/tenderPricing";

export const DEFAULT_TENDER_PRICING_RULES: TenderPricingRules = {
  vatRate: 0.15,
  marginPercentage: 0.18,
  minimumMarginPercentage: 0.12,
  overheadPercentage: 0.08,
  riskPercentage: 0.04,
  contingencyPercentage: 0.03,
  handlingPercentage: 0.02,
  labourRatePerUnit: 0,
  highMarkupPercentage: 0.55,
  lowPriceVariancePercentage: 0.2,
  directorApprovalThreshold: 1_000_000,
};

const TORQUE_EMPIRE_NAME = "torque empire";
const LOW_CONFIDENCE_THRESHOLD = 0.72;

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function pct(value: number): number {
  return Math.round(value * 10000) / 100;
}

export function normalizeTenderPricingText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\(pty\)|pty ltd|proprietary limited|\bltd\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizeTenderPricingText(value).split(" ").filter((token) => token.length >= 2));
}

function similarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((token) => b.has(token)).length;
  return overlap / Math.max(a.size, b.size);
}

function sameUnit(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalizeTenderPricingText(left) === normalizeTenderPricingText(right);
}

function isExpired(value: string | null | undefined, today = new Date()): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < new Date(today.toDateString()).getTime();
}

function isHistoricalSupplierQuote(quote: SupplierQuote): boolean {
  return quote.approvalStatus === 'REJECTED' || quote.workflowStatus === 'REJECTED' || quote.workflowStatus === 'SUPERSEDED';
}

export function getEligibleSupplierQuotes(input: TenderPricingBuildInput): SupplierQuote[] {
  return input.supplierQuotes.filter((quote) => {
    if (isHistoricalSupplierQuote(quote)) return false;
    if (quote.approvalStatus !== "APPROVED" && quote.approvalStatus !== "LOCKED") return false;
    if (quote.workspaceId !== input.workspaceId) return false;
    if (input.dealId && quote.dealId !== input.dealId) return false;
    if (input.opportunityId && quote.opportunityId !== input.opportunityId) return false;
    if (isExpired(quote.validityDate, input.today)) return false;
    return quote.lineItems.length > 0;
  });
}

function blocker(code: string, message: string, severity: TenderPricingBlocker["severity"] = "BLOCKER", extra: Partial<TenderPricingBlocker> = {}): TenderPricingBlocker {
  return { code, message, severity, ...extra };
}

export function validateTenderPricingSources(input: TenderPricingSourceValidationInput): TenderPricingBlocker[] {
  const blockers: TenderPricingBlocker[] = [];
  const contractorName = normalizeTenderPricingText(input.contractorName);

  if (!contractorName.includes(TORQUE_EMPIRE_NAME)) {
    blockers.push(blocker("CONTRACTOR_NOT_TORQUE_EMPIRE", "Torque Empire (Pty) Ltd must be the bidding contractor before tender pricing can start."));
  }

  const currentQuotes = input.supplierQuotes.filter((quote) => !isHistoricalSupplierQuote(quote));

  if (!currentQuotes.length) {
    blockers.push(blocker("APPROVED_SUPPLIER_QUOTES_REQUIRED", "At least one approved supplier quote is required."));
  }

  if (!input.tenderIntelligenceApproved) {
    blockers.push(blocker("TENDER_INTELLIGENCE_APPROVAL_REQUIRED", "Tender intelligence must be approved before pricing starts."));
  }

  if (!input.tenderLineItems.length) {
    blockers.push(blocker("TENDER_LINE_ITEMS_REQUIRED", "Approved BOQ or pricing schedule line items are required."));
  }

  for (const line of input.tenderLineItems) {
    if (line.quantityMode === "UNIT_RATE_ONLY") {
      if (line.quantity !== null || !line.unit || !line.sourcePage || line.sourcePage < 1) blockers.push(blocker("UNIT_RATE_EVIDENCE_REQUIRED", "Unit-rate source evidence is incomplete.", "BLOCKER", { tenderLineItemId: line.id }));
    } else if (typeof line.quantity !== "number" || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      blockers.push(blocker("TENDER_LINE_QUANTITY_REQUIRED", "A positive tender quantity is required.", "BLOCKER", { tenderLineItemId: line.id }));
    }
  }

  if (input.sourcePricingDocumentRequired && (!input.sourcePricingDocumentId || !input.sourcePricingDocumentPath)) {
    blockers.push(blocker("SOURCE_PRICING_DOCUMENT_REQUIRED", "The source pricing schedule document is required for AI fill."));
  }

  for (const quote of currentQuotes) {
    if (quote.workspaceId !== input.workspaceId) {
      blockers.push(blocker("QUOTE_WORKSPACE_MISMATCH", `Supplier quote ${quote.id} belongs to a different workspace.`, "BLOCKER", { supplierQuoteId: quote.id }));
    }
    if (quote.approvalStatus !== "APPROVED" && quote.approvalStatus !== "LOCKED") {
      blockers.push(blocker("QUOTE_NOT_APPROVED", `Supplier quote ${quote.id} is not approved.`, "BLOCKER", { supplierQuoteId: quote.id }));
    }
    if (isExpired(quote.validityDate, input.today)) {
      blockers.push(blocker("QUOTE_EXPIRED", `Supplier quote ${quote.id} has expired.`, "BLOCKER", { supplierQuoteId: quote.id }));
    }
    if (!quote.lineItems.length) {
      blockers.push(blocker("QUOTE_LINE_ITEMS_REQUIRED", `Supplier quote ${quote.id} has no normalized line items.`, "BLOCKER", { supplierQuoteId: quote.id }));
    }
  }

  return blockers;
}

function scoreQuoteLine(tenderLine: TenderPricingTenderLineItem, quote: SupplierQuote, supplierLine: SupplierQuoteLineItem): { score: number; reason: string; quantityConversion: number; unitConversion: number; conversionReason: string } {
  const descriptionScore = similarity(tenderLine.normalizedDescription ?? tenderLine.description, supplierLine.normalisedDescription || supplierLine.sourceDescription);
  const codeScore = tenderLine.itemCode && supplierLine.supplierSku && normalizeTenderPricingText(tenderLine.itemCode) === normalizeTenderPricingText(supplierLine.supplierSku) ? 0.2 : 0;
  const skuScore = supplierLine.supplierSku && normalizeTenderPricingText(tenderLine.description).includes(normalizeTenderPricingText(supplierLine.supplierSku)) ? 0.1 : 0;
  const unitMatch = sameUnit(tenderLine.unit, supplierLine.unit);
  const unitScore = unitMatch ? 0.18 : 0;
  const unitRateOnly = tenderLine.quantityMode === "UNIT_RATE_ONLY";
  const quantityDelta = Math.abs((supplierLine.quantity || 0) - (tenderLine.quantity || 0));
  const quantityScore = !unitRateOnly && tenderLine.quantity && tenderLine.quantity > 0 ? Math.max(0, 0.12 - (quantityDelta / tenderLine.quantity) * 0.12) : 0;
  const specScore = tenderLine.specification && similarity(tenderLine.specification, supplierLine.sourceDescription) > 0.35 ? 0.08 : 0;
  const score = Math.min(1, descriptionScore * 0.5 + codeScore + skuScore + unitScore + quantityScore + specScore);
  return {
    score,
    reason: `Matched on description ${pct(descriptionScore)}%, unit ${unitMatch ? "match" : "mismatch"}, item code/SKU evidence ${pct(codeScore + skuScore)}%.`,
    quantityConversion: !unitRateOnly && supplierLine.quantity > 0 && tenderLine.quantity ? tenderLine.quantity / supplierLine.quantity : 1,
    unitConversion: unitMatch ? 1 : 0,
    conversionReason: unitMatch ? "Tender unit and supplier unit match." : "Unit mismatch requires staff-approved conversion.",
  };
}

export function mapSupplierQuotesToTenderLines(input: {
  tenderLineItems: TenderPricingTenderLineItem[];
  supplierQuotes: SupplierQuote[];
  manualMappings?: TenderLineMapping[];
}): TenderLineMapping[] {
  const manualByLine = new Map((input.manualMappings ?? []).map((mapping) => [mapping.tenderLineItemId, mapping]));
  const mappings: TenderLineMapping[] = [];

  for (const tenderLine of input.tenderLineItems) {
    const manual = manualByLine.get(tenderLine.id);
    if (manual) {
      mappings.push({ ...manual, reviewStatus: manual.reviewStatus === "APPROVED" ? "APPROVED" : "MANUAL_MAPPING" });
      continue;
    }

    const candidates = input.supplierQuotes.flatMap((quote) => quote.lineItems.map((line) => ({ quote, line, scored: scoreQuoteLine(tenderLine, quote, line) })));
    const best = candidates.sort((left, right) => right.scored.score - left.scored.score)[0];
    if (!best || best.scored.score <= 0.15) {
      mappings.push({
        id: `mapping-${tenderLine.id}-unmatched`,
        tenderLineItemId: tenderLine.id,
        supplierQuoteId: "",
        supplierLineItemId: "",
        supplierName: "",
        matchConfidence: 0,
        mappingReason: "No supplier quote line item matched this tender line.",
        quantityConversion: 1,
        unitConversion: 1,
        conversionReason: "No conversion available because the line is unmatched.",
        supplierUnitCost: 0,
        priceSource: "APPROVED_SUPPLIER_QUOTE",
        reviewStatus: "UNMATCHED",
      });
      continue;
    }

    const requiresReview = best.scored.score < LOW_CONFIDENCE_THRESHOLD || best.scored.unitConversion === 0;
    mappings.push({
      id: `mapping-${tenderLine.id}-${best.quote.id}-${best.line.id}`,
      tenderLineItemId: tenderLine.id,
      supplierQuoteId: best.quote.id,
      supplierLineItemId: best.line.id,
      supplierName: best.quote.supplierName,
      matchConfidence: roundMoney(best.scored.score),
      mappingReason: best.scored.reason,
      quantityConversion: roundMoney(best.scored.quantityConversion),
      unitConversion: best.scored.unitConversion,
      conversionReason: best.scored.conversionReason,
      supplierUnitCost: best.line.unitPrice,
      priceSource: "APPROVED_SUPPLIER_QUOTE",
      reviewStatus: requiresReview ? "REVIEW_REQUIRED" : "MATCHED",
    });
  }

  return mappings;
}

export function compareTenderSupplierOptions(tenderLine: TenderPricingTenderLineItem, supplierQuotes: SupplierQuote[], today = new Date()): TenderSupplierOption[] {
  const rows = supplierQuotes.flatMap((quote) => quote.lineItems.map((line) => {
    const scored = scoreQuoteLine(tenderLine, quote, line);
    const expired = isExpired(quote.validityDate, today);
    const exclusions = quote.extraction.exclusions.value ?? [];
    const deliveryRisk = /tbc|unknown|month/i.test(String(quote.deliveryPeriod ?? "")) ? 20 : 0;
    const completeness = Math.round(Math.min(100, scored.score * 100 + (quote.paymentTerms ? 5 : 0) + (quote.validityDate ? 5 : 0) - (exclusions.length ? 10 : 0)));
    const riskScore = completeness - (expired ? 40 : 0) - deliveryRisk;
    const commercialRisk: TenderSupplierOption["commercialRisk"] = riskScore >= 72 ? "LOW" : riskScore >= 45 ? "MEDIUM" : "HIGH";
    return {
      tenderLineItemId: tenderLine.id,
      supplierQuoteId: quote.id,
      supplierLineItemId: line.id,
      supplier: quote.supplierName,
      unitCost: line.unitPrice,
      totalCost: tenderLine.quantityMode === "UNIT_RATE_ONLY" ? line.unitPrice : roundMoney(line.unitPrice * (tenderLine.quantity ?? 0)),
      quoteValidity: quote.validityDate ?? null,
      stockDeliveryPeriod: quote.deliveryPeriod ?? null,
      paymentTerms: quote.paymentTerms ?? null,
      exclusions,
      completeness,
      commercialRisk,
      alternativeSupplier: false,
      recommendedOption: false,
      recommendationReason: `Balanced score includes specification match, validity, delivery, terms, completeness, approved status, risk, and margin impact.`,
      approvedStatus: quote.approvalStatus,
    } satisfies TenderSupplierOption;
  }));

  const approvedRows = rows.filter((row) => row.approvedStatus === "APPROVED" || row.approvedStatus === "LOCKED");
  const winner = approvedRows.sort((left, right) => {
    const riskDelta = ({ LOW: 3, MEDIUM: 2, HIGH: 1 }[right.commercialRisk] - { LOW: 3, MEDIUM: 2, HIGH: 1 }[left.commercialRisk]);
    if (riskDelta !== 0) return riskDelta;
    if (right.completeness !== left.completeness) return right.completeness - left.completeness;
    return left.totalCost - right.totalCost;
  })[0];

  return rows
    .map((row) => ({
      ...row,
      alternativeSupplier: winner ? row.supplierQuoteId !== winner.supplierQuoteId || row.supplierLineItemId !== winner.supplierLineItemId : false,
      recommendedOption: winner ? row.supplierQuoteId === winner.supplierQuoteId && row.supplierLineItemId === winner.supplierLineItemId : false,
    }))
    .sort((left, right) => Number(right.recommendedOption) - Number(left.recommendedOption) || right.completeness - left.completeness);
}

function riskFlags(args: {
  line: TenderPricingTenderLineItem;
  mapping: TenderLineMapping | null;
  supplierQuote?: SupplierQuote;
  sourceCost: number;
  tenderLineTotal: number;
  grossProfit: number;
  grossMarginPercentage: number;
  rules: TenderPricingRules;
  priceSource: TenderPricingSource | "UNPRICED";
  manualReason?: string | null;
  provisionalApprovedBy?: string | null;
  today?: Date;
}): TenderPricingRiskCode[] {
  const flags: TenderPricingRiskCode[] = [];
  if (args.priceSource === "UNPRICED") flags.push("MISSING_ITEM");
  if (args.grossProfit < 0 || args.grossMarginPercentage < 0) flags.push("NEGATIVE_MARGIN");
  if (args.grossMarginPercentage > 0 && args.grossMarginPercentage < pct(args.rules.minimumMarginPercentage)) flags.push("LOW_MARGIN");
  if (args.supplierQuote && isExpired(args.supplierQuote.validityDate, args.today)) flags.push("EXPIRED_SUPPLIER_QUOTE");
  if (args.mapping?.unitConversion === 0) flags.push("UNIT_MISMATCH", "UNSUPPORTED_CONVERSION");
  if (args.mapping && args.mapping.reviewStatus === "REVIEW_REQUIRED" && args.mapping.matchConfidence < LOW_CONFIDENCE_THRESHOLD) flags.push("LOW_CONFIDENCE_MAPPING");
  if (args.supplierQuote?.extraction.exclusions.value?.length) flags.push("QUOTE_EXCLUSIONS");
  if (args.priceSource === "MANUAL_ENTRY" && !args.manualReason) flags.push("MANUAL_REASON_REQUIRED");
  if (args.priceSource === "PROVISIONAL" && !args.provisionalApprovedBy) flags.push("PROVISIONAL_APPROVAL_REQUIRED", "PROVISIONAL_PRICING");
  const markup = args.sourceCost > 0 ? (args.tenderLineTotal - args.sourceCost) / args.sourceCost : 0;
  if (markup > args.rules.highMarkupPercentage) flags.push("HIGH_MARKUP");
  if (args.tenderLineTotal > 0 && args.sourceCost > 0 && markup < -args.rules.lowPriceVariancePercentage) flags.push("LOW_PRICE");
  return Array.from(new Set(flags));
}

export function calculateTenderPricingLine(args: {
  tenderLine: TenderPricingTenderLineItem;
  mapping: TenderLineMapping | null;
  supplierQuote?: SupplierQuote;
  supplierLine?: SupplierQuoteLineItem;
  options: TenderSupplierOption[];
  rules: TenderPricingRules;
  manualPrice?: { unitPrice: number; reason?: string | null; provisional?: boolean; approvedBy?: string | null; approvedAt?: string | null };
  today?: Date;
}): TenderPricingLineItem {
  const manual = args.manualPrice;
  const hasApprovedMapping = args.mapping && ["MATCHED", "AUTO_MATCHED", "APPROVED", "MANUAL_MAPPING"].includes(args.mapping.reviewStatus) && args.mapping.unitConversion !== 0;
  const source: TenderPricingSource | "UNPRICED" = manual?.provisional ? "PROVISIONAL" : manual ? "MANUAL_ENTRY" : hasApprovedMapping ? "APPROVED_SUPPLIER_QUOTE" : "UNPRICED";
  const unitRateOnly = args.tenderLine.quantityMode === "UNIT_RATE_ONLY";
  const quantityMultiplier = unitRateOnly ? 1 : args.tenderLine.quantity ?? 0;
  const supplierUnitCost = source === "APPROVED_SUPPLIER_QUOTE" ? args.mapping?.supplierUnitCost ?? args.supplierLine?.unitPrice ?? 0 : manual?.unitPrice ?? 0;
  const sourceCost = roundMoney(supplierUnitCost * quantityMultiplier);
  const delivery = roundMoney((args.supplierQuote?.deliveryCost ?? 0) / Math.max(1, args.supplierQuote?.lineItems.length ?? 1));
  const handling = roundMoney(sourceCost * args.rules.handlingPercentage);
  const labour = roundMoney((args.rules.labourRatePerUnit ?? 0) * quantityMultiplier);
  const overhead = roundMoney((sourceCost + delivery + handling + labour) * args.rules.overheadPercentage);
  const risk = roundMoney((sourceCost + delivery + handling + labour + overhead) * args.rules.riskPercentage);
  const contingency = roundMoney((sourceCost + delivery + handling + labour + overhead + risk) * args.rules.contingencyPercentage);
  const costBase = roundMoney(sourceCost + delivery + handling + labour + overhead + risk + contingency);
  const profit = roundMoney(costBase * args.rules.marginPercentage);
  const subtotal = source === "UNPRICED" ? 0 : roundMoney(costBase + profit);
  const vat = unitRateOnly ? 0 : roundMoney(subtotal * args.rules.vatRate);
  const grossProfit = roundMoney(subtotal - costBase);
  const grossMarginPercentage = subtotal !== 0 ? pct(grossProfit / Math.abs(subtotal)) : 0;
  const flags = riskFlags({
    line: args.tenderLine,
    mapping: args.mapping,
    supplierQuote: args.supplierQuote,
    sourceCost,
    tenderLineTotal: subtotal,
    grossProfit,
    grossMarginPercentage,
    rules: args.rules,
    priceSource: source,
    manualReason: manual?.reason,
    provisionalApprovedBy: manual?.approvedBy,
    today: args.today,
  });

  return {
    ...args.tenderLine,
    mapping: args.mapping,
    supplierOptions: args.options,
    sourceCost,
    supplierSubtotal: sourceCost,
    deliveryAllocation: delivery,
    handlingAllocation: handling,
    labourAllocation: labour,
    overheadAllocation: overhead,
    riskAllowance: risk,
    contingency,
    profitMargin: profit,
    vatTreatment: "EXCLUSIVE",
    tenderUnitPrice: unitRateOnly ? subtotal : args.tenderLine.quantity && args.tenderLine.quantity > 0 ? roundMoney(subtotal / args.tenderLine.quantity) : subtotal,
    tenderLineTotal: unitRateOnly ? null : subtotal,
    grossProfit,
    grossMarginPercentage,
    priceSource: source,
    manualPriceReason: manual?.reason ?? null,
    provisionalApprovedBy: manual?.approvedBy ?? null,
    provisionalApprovedAt: manual?.approvedAt ?? null,
    riskFlags: flags,
    calculationEvidence: {
      sourceCost,
      additions: { delivery, handling, labour, overhead, risk, contingency },
      margin: profit,
      vat,
      formula: "((supplier unit cost * tender quantity) + delivery + handling + labour + overhead + risk + contingency) * (1 + margin) + VAT",
      assumptions: [
        `VAT rate ${pct(args.rules.vatRate)}%`,
        `Margin ${pct(args.rules.marginPercentage)}%`,
        source === "MANUAL_ENTRY" ? "Manual price is not supplier-derived." : "Supplier prices are from approved supplier quote records.",
      ],
    },
  };
}

function lineBlockers(line: TenderPricingLineItem): TenderPricingBlocker[] {
  const compulsoryCodes: TenderPricingRiskCode[] = [
    "MISSING_ITEM",
    "NEGATIVE_MARGIN",
    "EXPIRED_SUPPLIER_QUOTE",
    "UNSUPPORTED_CONVERSION",
    "LOW_CONFIDENCE_MAPPING",
    "MANUAL_REASON_REQUIRED",
    "PROVISIONAL_APPROVAL_REQUIRED",
  ];
  return line.riskFlags
    .filter((code) => compulsoryCodes.includes(code))
    .map((code) => blocker(code, `${line.description}: ${code.toLowerCase().replace(/_/g, " ")}`, "BLOCKER", { tenderLineItemId: line.id, supplierQuoteId: line.mapping?.supplierQuoteId ?? null }));
}

function statusFor(blockers: TenderPricingBlocker[], lines: TenderPricingLineItem[], sourceBlockers: TenderPricingBlocker[]): TenderPricingStatus {
  if (sourceBlockers.some((item) => item.code === "APPROVED_SUPPLIER_QUOTES_REQUIRED")) return "SOURCE_QUOTES_REQUIRED";
  if (sourceBlockers.some((item) => item.code === "TENDER_INTELLIGENCE_APPROVAL_REQUIRED" || item.code === "TENDER_LINE_ITEMS_REQUIRED")) return "TENDER_ANALYSIS_REQUIRED";
  if (lines.some((line) => line.priceSource === "UNPRICED" || line.mapping?.reviewStatus === "UNMATCHED")) return "MAPPING_REQUIRED";
  if (blockers.length) return "VALIDATION_FAILED";
  return "REVIEW_REQUIRED";
}

export function buildTenderPricingWorkspace(input: TenderPricingBuildInput): TenderPricingWorkspace {
  const now = input.now ?? new Date().toISOString();
  const rules = { ...DEFAULT_TENDER_PRICING_RULES, ...(input.rules ?? {}) };
  const sourceBlockers = validateTenderPricingSources(input);
  const approvedQuotes = getEligibleSupplierQuotes(input);
  const mappings = mapSupplierQuotesToTenderLines({ tenderLineItems: input.tenderLineItems, supplierQuotes: approvedQuotes, manualMappings: input.manualMappings });
  const quoteById = new Map(approvedQuotes.map((quote) => [quote.id, quote]));
  const manualByLine = new Map((input.manualPrices ?? []).map((price) => [price.tenderLineItemId, price]));
  const lines = input.tenderLineItems.map((tenderLine) => {
    const mapping = mappings.find((candidate) => candidate.tenderLineItemId === tenderLine.id) ?? null;
    const quote = mapping?.supplierQuoteId ? quoteById.get(mapping.supplierQuoteId) : undefined;
    const supplierLine = quote?.lineItems.find((line) => line.id === mapping?.supplierLineItemId);
    return calculateTenderPricingLine({
      tenderLine,
      mapping,
      supplierQuote: quote,
      supplierLine,
      options: compareTenderSupplierOptions(tenderLine, approvedQuotes, input.today),
      rules,
      manualPrice: manualByLine.get(tenderLine.id),
      today: input.today,
    });
  });
  const lineLevelBlockers = lines.flatMap(lineBlockers);
  const blockers = [...sourceBlockers, ...lineLevelBlockers];
  const hasUnitRateLines = lines.some((line) => line.quantityMode === "UNIT_RATE_ONLY");
  const hasFixedQuantityLines = lines.some((line) => line.quantityMode !== "UNIT_RATE_ONLY");
  const pricingAggregationMode = hasUnitRateLines ? hasFixedQuantityLines ? "MIXED" : "UNIT_RATE_ONLY" : "FIXED_QUANTITY";
  const subtotal = hasUnitRateLines ? null : roundMoney(lines.reduce((sum, line) => sum + (line.tenderLineTotal ?? 0), 0));
  const vat = hasUnitRateLines ? null : roundMoney(lines.reduce((sum, line) => sum + line.calculationEvidence.vat, 0));
  const total = subtotal === null || vat === null ? null : roundMoney(subtotal + vat);
  const totalSupplierCost = hasUnitRateLines ? null : roundMoney(lines.reduce((sum, line) => sum + line.sourceCost, 0));
  const grossProfit = hasUnitRateLines ? null : roundMoney(lines.reduce((sum, line) => sum + (line.grossProfit ?? 0), 0));
  const grossMarginPercentage = subtotal !== null && subtotal !== 0 && grossProfit !== null ? pct(grossProfit / Math.abs(subtotal)) : null;
  const pricingStatus = statusFor(blockers, lines, sourceBlockers);
  const directorRequired = Boolean(rules.directorApprovalThreshold && typeof total === "number" && total >= rules.directorApprovalThreshold);

  return {
    id: input.id ?? `tender-pricing-${input.dealId}-r1`,
    workspaceId: input.workspaceId,
    opportunityId: input.opportunityId,
    dealId: input.dealId,
    contractorId: input.contractorId,
    contractorName: input.contractorName,
    tenderIntelligenceId: input.tenderIntelligenceId ?? null,
    sourcePricingDocumentId: input.sourcePricingDocumentId ?? null,
    sourcePricingDocumentPath: input.sourcePricingDocumentPath ?? null,
    approvedSupplierQuoteIds: approvedQuotes.map((quote) => quote.id),
    pricingStatus,
    mappingStatus: lines.some((line) => line.mapping?.reviewStatus === "REVIEW_REQUIRED" || line.mapping?.reviewStatus === "UNMATCHED") ? "MAPPING_REQUIRED" : "PRICING_IN_PROGRESS",
    commercialReviewStatus: pricingStatus === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "NOT_STARTED",
    managementApprovalStatus: directorRequired ? "DIRECTOR_REQUIRED" : "MANAGER_REQUIRED",
    documentFillStatus: "NOT_STARTED",
    validationStatus: blockers.length ? "VALIDATION_FAILED" : "NOT_STARTED",
    lockStatus: "UNLOCKED",
    currency: approvedQuotes[0]?.currency ?? "ZAR",
    subtotal,
    vat,
    total,
    totalSupplierCost,
    deliveryCost: roundMoney(lines.reduce((sum, line) => sum + line.deliveryAllocation, 0)),
    handlingCost: roundMoney(lines.reduce((sum, line) => sum + line.handlingAllocation, 0)),
    overheadCost: roundMoney(lines.reduce((sum, line) => sum + line.overheadAllocation, 0)),
    riskAllowance: roundMoney(lines.reduce((sum, line) => sum + line.riskAllowance, 0)),
    contingency: roundMoney(lines.reduce((sum, line) => sum + line.contingency, 0)),
    grossProfit,
    grossMarginPercentage,
    pricingAggregationMode,
    lineItems: lines,
    blockers,
    nextAction: blockers.length ? blockers[0].message : "Submit pricing for manager review.",
    revision: 1,
    previousRevisionId: null,
    revisions: [],
    approvals: [],
    documentFillEvidence: null,
    submissionReviewHandoff: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    approvedBy: null,
    approvedAt: null,
    lockedBy: null,
    lockedAt: null,
  };
}

export function approveTenderPricing(workspace: TenderPricingWorkspace, approver: { uid: string; role: "staff" | "manager" | "director"; notes?: string | null }, now = new Date().toISOString()): TenderPricingWorkspace {
  if (workspace.lockStatus === "LOCKED") throw new Error("Locked pricing cannot be approved again.");
  if (workspace.blockers.some((item) => item.severity === "BLOCKER")) throw new Error("Unresolved pricing blockers prevent approval.");
  const approval = {
    status: approver.role === "staff" ? "STAFF_APPROVED" as const : approver.role === "manager" ? "MANAGER_APPROVED" as const : "DIRECTOR_APPROVED" as const,
    approvedBy: approver.uid,
    approvedAt: now,
    notes: approver.notes ?? null,
    role: approver.role,
    total: workspace.total,
    margin: workspace.grossMarginPercentage,
    revision: workspace.revision,
  };
  const approvals = [...workspace.approvals, approval];
  const hasStaff = approvals.some((item) => item.role === "staff");
  const hasManager = approvals.some((item) => item.role === "manager");
  const directorRequired = workspace.managementApprovalStatus === "DIRECTOR_REQUIRED";
  const hasDirector = approvals.some((item) => item.role === "director");
  const fullyApproved = hasStaff && hasManager && (!directorRequired || hasDirector);
  return {
    ...workspace,
    approvals,
    commercialReviewStatus: hasStaff ? "STAFF_APPROVED" : workspace.commercialReviewStatus,
    managementApprovalStatus: hasManager ? (directorRequired && !hasDirector ? "DIRECTOR_REQUIRED" : "MANAGER_APPROVED") : workspace.managementApprovalStatus,
    pricingStatus: fullyApproved ? "APPROVED" : hasStaff ? "MANAGER_APPROVAL_REQUIRED" : workspace.pricingStatus,
    approvedBy: fullyApproved ? approver.uid : workspace.approvedBy ?? null,
    approvedAt: fullyApproved ? now : workspace.approvedAt ?? null,
    updatedAt: now,
    nextAction: fullyApproved ? "Generate priced document." : "Complete remaining pricing approvals.",
  };
}

export function createTenderPricingRevision(workspace: TenderPricingWorkspace, change: { changedBy: string; reason: string; newTotal: number; newMargin: number }, now = new Date().toISOString()): TenderPricingWorkspace {
  if (workspace.lockStatus !== "LOCKED") {
    throw new Error("Revision creation is reserved for locked approved pricing records.");
  }
  return {
    ...workspace,
    id: `${workspace.id}-r${workspace.revision + 1}`,
    previousRevisionId: workspace.id,
    revision: workspace.revision + 1,
    pricingStatus: "PRICING_IN_PROGRESS",
    commercialReviewStatus: "REVIEW_REQUIRED",
    managementApprovalStatus: "MANAGER_REQUIRED",
    lockStatus: "UNLOCKED",
    total: change.newTotal,
    grossMarginPercentage: change.newMargin,
    approvedBy: null,
    approvedAt: null,
    lockedBy: null,
    lockedAt: null,
    approvals: [],
    revisions: [
      ...workspace.revisions,
      {
        revision: workspace.revision + 1,
        previousRevisionId: workspace.id,
        changedBy: change.changedBy,
        changedAt: now,
        changeReason: change.reason,
        previousTotal: workspace.total,
        newTotal: change.newTotal,
        previousMargin: workspace.grossMarginPercentage,
        newMargin: change.newMargin,
        approvalReset: true,
      },
    ],
    updatedAt: now,
    nextAction: "Review revised pricing and reset approvals.",
  };
}

export function buildPricingScheduleFillEvidence(workspace: TenderPricingWorkspace): TenderPricingDocumentFillEvidence {
  const warnings: string[] = [];
  if (workspace.pricingStatus !== "APPROVED") warnings.push("Only approved pricing values should be used for final document fill.");
  if (!workspace.sourcePricingDocumentId || !workspace.sourcePricingDocumentPath) warnings.push("Source pricing schedule document is missing.");
  const fieldMappings: TenderPricingDocumentFillEvidence["fieldMappings"] = workspace.lineItems
    .filter((line) => line.priceSource !== "UNPRICED")
    .flatMap((line) => [
      { tenderLineItemId: line.id, fieldName: `${line.id}.unitPrice`, page: line.sourcePage ?? null, value: line.tenderUnitPrice.toFixed(2), source: "approved_pricing_record" as const, confidence: 0.98 },
      { tenderLineItemId: line.id, fieldName: `${line.id}.amount`, page: line.sourcePage ?? null, value: line.tenderLineTotal?.toFixed(2) ?? "", source: "approved_pricing_record" as const, confidence: 0.98 },
    ]);
  if (workspace.pricingAggregationMode === "FIXED_QUANTITY") fieldMappings.push(
    { fieldName: "subtotal", page: null, value: workspace.subtotal?.toFixed(2) ?? "", source: "approved_pricing_record", confidence: 1 },
    { fieldName: "vat", page: null, value: workspace.vat?.toFixed(2) ?? "", source: "approved_pricing_record", confidence: 1 },
    { fieldName: "grandTotal", page: null, value: workspace.total?.toFixed(2) ?? "", source: "approved_pricing_record", confidence: 1 },
  );
  return {
    sourceDocumentId: workspace.sourcePricingDocumentId ?? "",
    sourceDocumentPath: workspace.sourcePricingDocumentPath ?? "",
    pricedDocumentId: `priced-${workspace.id}`,
    pricedDocumentUrl: null,
    originalPreserved: true,
    fieldMappings,
    warnings,
    validationIssues: warnings.filter((warning) => warning !== "Only approved pricing values should be used for final document fill."),
  };
}

export function validateTenderPricingWorkspace(workspace: TenderPricingWorkspace, fillEvidence = workspace.documentFillEvidence): TenderPricingBlocker[] {
  const blockers = [...workspace.blockers];
  for (const line of workspace.lineItems) {
    if (line.compulsory && line.priceSource === "UNPRICED") blockers.push(blocker("COMPULSORY_LINE_UNPRICED", `${line.description} is compulsory and unpriced.`, "BLOCKER", { tenderLineItemId: line.id }));
    if (line.mapping?.reviewStatus === "REVIEW_REQUIRED") blockers.push(blocker("LOW_CONFIDENCE_MAPPING_UNAPPROVED", `${line.description} has an unapproved low-confidence mapping.`, "BLOCKER", { tenderLineItemId: line.id }));
    if (line.mapping?.unitConversion === 0) blockers.push(blocker("UNIT_CONVERSION_UNAPPROVED", `${line.description} requires approved unit conversion.`, "BLOCKER", { tenderLineItemId: line.id }));
  }
  const hasUnitRateLines = workspace.lineItems.some((line) => line.quantityMode === "UNIT_RATE_ONLY");
  if (hasUnitRateLines) {
    if (workspace.subtotal !== null || workspace.vat !== null || workspace.total !== null || workspace.totalSupplierCost !== null) blockers.push(blocker("UNIT_RATE_TOTAL_NOT_APPLICABLE", "Fixed totals are not applicable to a unit-rate schedule."));
    if (workspace.lineItems.some((line) => line.quantityMode === "UNIT_RATE_ONLY" && line.tenderLineTotal !== null)) blockers.push(blocker("UNIT_RATE_EXTENDED_TOTAL_UNSUPPORTED", "Unit-rate lines must not have an extended total."));
  } else {
    const recalculatedSubtotal = roundMoney(workspace.lineItems.reduce((sum, line) => sum + (line.tenderLineTotal ?? 0), 0));
    const recalculatedVat = roundMoney(workspace.lineItems.reduce((sum, line) => sum + line.calculationEvidence.vat, 0));
    if (recalculatedSubtotal !== workspace.subtotal) blockers.push(blocker("SUBTOTAL_MISMATCH", "Tender subtotal does not reconcile."));
    if (recalculatedVat !== workspace.vat) blockers.push(blocker("VAT_MISMATCH", "Tender VAT does not reconcile."));
    if (workspace.subtotal === null || workspace.vat === null || roundMoney(workspace.subtotal + workspace.vat) !== workspace.total) blockers.push(blocker("TOTAL_MISMATCH", "Tender total does not reconcile."));
  }
  if (fillEvidence) {
    const usesApprovedPricingValues = fillEvidence.fieldMappings.some((field) => field.source === "approved_pricing_record");
    const approvalStatusCurrent = ["APPROVED", "DOCUMENT_FILLED", "VALIDATED", "LOCKED"].includes(workspace.pricingStatus) || workspace.lockStatus === "LOCKED";
    const approvalsStale = (workspace.approvals ?? []).some((approval) => approval.revision !== workspace.revision);
    const approvalMetadataPresent = Boolean(workspace.approvedBy && workspace.approvedAt) || (workspace.approvals ?? []).some((approval) => approval.revision === workspace.revision && approval.role === "manager");
    if (usesApprovedPricingValues && approvalsStale) blockers.push(blocker("PDF_STALE_APPROVAL", "Pricing approval evidence is stale for the current revision."));
    if (usesApprovedPricingValues && (!approvalStatusCurrent || !approvalMetadataPresent)) blockers.push(blocker("PDF_UNAPPROVED_PRICING_VALUE", "Only approved pricing values may be used for final document fill."));
    if (!fillEvidence.originalPreserved) blockers.push(blocker("SOURCE_DOCUMENT_MUTATED", "Source pricing document must remain unchanged."));
    if (fillEvidence.validationIssues.length) {
      blockers.push(...fillEvidence.validationIssues.map((issue) => blocker("PDF_FILL_VALIDATION_ISSUE", issue)));
    }
    const values = new Map(fillEvidence.fieldMappings.map((field) => [field.fieldName, field.value]));
    if (values.get("grandTotal") && Number(values.get("grandTotal")) !== workspace.total) blockers.push(blocker("PDF_TOTAL_MISMATCH", "Filled PDF grand total does not match approved pricing record."));
  }
  return blockers;
}

function hasCurrentApproval(workspace: TenderPricingWorkspace, role: "staff" | "manager" | "director"): boolean {
  return workspace.approvals.some((approval) => approval.revision === workspace.revision && approval.role === role && Boolean(approval.approvedBy && approval.approvedAt));
}

function hasRequiredPricingApproval(workspace: TenderPricingWorkspace): boolean {
  if (!hasCurrentApproval(workspace, "staff") || !hasCurrentApproval(workspace, "manager")) return false;
  const directorRequired = workspace.managementApprovalStatus === "DIRECTOR_REQUIRED";
  return !directorRequired || hasCurrentApproval(workspace, "director");
}

function hasValidatedPricedDocument(workspace: TenderPricingWorkspace): boolean {
  const filled = workspace.documentFillStatus === "DOCUMENT_FILLED" || workspace.documentFillStatus === "APPROVED";
  return filled && workspace.validationStatus === "VALIDATED" && Boolean(workspace.documentFillEvidence?.pricedDocumentId) && (workspace.documentFillEvidence?.validationIssues.length ?? 0) === 0;
}

export function lockTenderPricing(workspace: TenderPricingWorkspace, actorUid: string, now = new Date().toISOString()): TenderPricingWorkspace {
  if (workspace.lockStatus === "LOCKED") return workspace;
  if (!hasRequiredPricingApproval(workspace)) throw new Error("Staff and manager pricing approval is required before locking.");
  if (!hasValidatedPricedDocument(workspace)) throw new Error("A validated priced document is required before locking.");
  const blockers = validateTenderPricingWorkspace(workspace);
  if (blockers.some((item) => item.severity === "BLOCKER")) throw new Error("Validation blockers prevent pricing lock.");
  return {
    ...workspace,
    pricingStatus: "LOCKED",
    validationStatus: "VALIDATED",
    lockStatus: "LOCKED",
    lockedBy: actorUid,
    lockedAt: now,
    updatedAt: now,
    nextAction: "Send approved priced document to Submission Review.",
  };
}

export function buildTenderPricingHandoff(workspace: TenderPricingWorkspace): TenderPricingHandoff {
  const unresolved = validateTenderPricingWorkspace(workspace);
  const approved = workspace.lockStatus === "LOCKED" && workspace.validationStatus === "VALIDATED";
  return {
    tenderPricingId: workspace.id,
    pricingStatus: workspace.pricingStatus,
    pricingApproved: approved,
    pricingDocumentId: workspace.documentFillEvidence?.pricedDocumentId ?? null,
    pricingDocumentUrl: workspace.documentFillEvidence?.pricedDocumentUrl ?? null,
    totalTenderValue: workspace.total,
    grossProfit: workspace.grossProfit,
    grossMargin: workspace.grossMarginPercentage,
    unresolvedPricingBlockers: unresolved,
    nextAction: approved ? "Continue document preparation." : unresolved[0]?.message ?? workspace.nextAction,
    workflowTransition: approved && unresolved.length === 0 ? "DOCUMENT_PREPARATION" : "BLOCKED",
  };
}
