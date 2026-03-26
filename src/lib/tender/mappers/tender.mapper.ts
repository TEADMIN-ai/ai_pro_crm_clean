import type { Deal, DealAuditEvent, DealDocument } from "@/types/deal";
import type {
  JsonObject,
  JsonValue,
  TenderData,
  TenderAnalysisSnapshot,
  TenderAuditActor,
  TenderAuditEvent,
  TenderComplianceSnapshot,
  TenderDocumentRef,
  TenderPartyRef,
  TenderPricingSnapshot,
  TenderReadinessSnapshot,
  TenderRequirement,
  TenderRiskLevel,
  TenderValueMoney,
} from "@/types/tender.types";
import type { SBD1OverlayInput } from "@/types/sbd";

type LegacyRequirementInput =
  | string
  | {
      id?: string;
      code?: string | null;
      title?: string | null;
      label?: string | null;
      description?: string | null;
      mandatory?: boolean | null;
      category?: string | null;
      sourceYear?: number | null;
    };

type LegacyDocumentInput = DealDocument & {
  type?: string | null;
  status?: "missing" | "uploaded" | "verified" | "rejected" | null;
  metadata?: Record<string, unknown>;
  content?: string | Uint8Array;
};

export type LegacyTenderSource = Partial<Deal> & {
  tenderId?: string;
  tenderTitle?: string;
  sourceYear?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  requirements?: LegacyRequirementInput[];
  documents?: LegacyDocumentInput[];
  buyerId?: string;
  buyerName?: string;
  ownerId?: string;
  ownerName?: string;
  tenderNumber?: string;
  description?: string;
  companyName?: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  contactNumber?: string;
  email?: string;
  vatNumber?: string;
  bbbee?: string;
  declarationName?: string;
  hasRelationship?: "YES" | "NO";
  directors?: Array<{
    name?: string;
    id?: string;
    entity?: string;
  }>;
};

export type TenderDataSource = TenderData | LegacyTenderSource;

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedValues = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );

  return normalizedValues.length > 0 ? normalizedValues : [];
}

function toIsoDateString(value: unknown): string | null | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const normalizedValue = value.trim();
    const date = new Date(normalizedValue);
    return Number.isNaN(date.getTime()) ? normalizedValue : date.toISOString();
  }

  return undefined;
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const normalizedArray = value
      .map((item) => toJsonValue(item))
      .filter((item): item is JsonValue => item !== undefined);
    return normalizedArray;
  }

  if (value && typeof value === "object") {
    const normalizedObject: JsonObject = {};

    for (const [key, item] of Object.entries(value)) {
      const normalizedItem = toJsonValue(item);
      if (normalizedItem !== undefined) {
        normalizedObject[key] = normalizedItem;
      }
    }

    return normalizedObject;
  }

  return undefined;
}

function toJsonObject(value: unknown): JsonObject | undefined {
  const normalizedValue = toJsonValue(value);

  if (!normalizedValue || Array.isArray(normalizedValue) || typeof normalizedValue !== "object") {
    return undefined;
  }

  return normalizedValue;
}

function resolveCurrency(source: LegacyTenderSource): string {
  return normalizeString(source.currency) ?? "ZAR";
}

function createMoney(amount: unknown, currency: string): TenderValueMoney | null {
  const normalizedAmount = normalizeNumber(amount);
  return normalizedAmount !== undefined ? { amount: normalizedAmount, currency } : null;
}

function resolveSourceYear(source: LegacyTenderSource): number {
  const explicitYear = normalizeNumber(source.sourceYear);
  if (explicitYear !== undefined) {
    return explicitYear;
  }

  const timestampCandidates = [
    source.tenderSubmittedAt,
    source.updatedAt,
    source.createdAt,
    source.closedAt,
  ];

  for (const candidate of timestampCandidates) {
    const isoValue = toIsoDateString(candidate);
    if (isoValue) {
      return new Date(isoValue).getUTCFullYear();
    }
  }

  return new Date().getUTCFullYear();
}

function mapParty(
  id: string | undefined,
  name: string | undefined,
  role: TenderPartyRef["role"]
): TenderPartyRef | null {
  if (!id && !name) {
    return null;
  }

  return {
    id: id ?? name ?? role,
    name: name ?? id ?? role,
    role,
  };
}

function mapRequirement(requirement: LegacyRequirementInput, index: number, sourceYear: number): TenderRequirement {
  if (typeof requirement === "string") {
    return {
      id: `requirement-${index + 1}`,
      title: requirement,
      mandatory: true,
      sourceYear,
    };
  }

  const title = normalizeString(requirement.title) ?? normalizeString(requirement.label) ?? `Requirement ${index + 1}`;

  return {
    id: normalizeString(requirement.id) ?? `requirement-${index + 1}`,
    code: normalizeString(requirement.code) ?? null,
    title,
    description: normalizeString(requirement.description) ?? null,
    mandatory: requirement.mandatory !== false,
    category: normalizeString(requirement.category) ?? null,
    sourceYear: normalizeNumber(requirement.sourceYear) ?? sourceYear,
  };
}

function mapRequirements(source: LegacyTenderSource, sourceYear: number): TenderRequirement[] {
  const explicitRequirements = Array.isArray(source.requirements) ? source.requirements : [];
  const missingRequirements = (source.missingRequirements ?? []).map((value) => ({
    title: value,
    mandatory: true,
    category: "compliance",
  }));
  const analysisRequirements = (source.tenderAnalysis?.requiredCertificates ?? []).map((value) => ({
    title: value,
    mandatory: true,
    category: "certificate",
  }));

  return [...explicitRequirements, ...missingRequirements, ...analysisRequirements].map((requirement, index) =>
    mapRequirement(requirement, index, sourceYear)
  );
}

function mapDocument(document: LegacyDocumentInput, index: number): TenderDocumentRef {
  return {
    id: normalizeString(document.id) ?? `document-${index + 1}`,
    name: normalizeString(document.name) ?? `Document ${index + 1}`,
    type: normalizeString(document.type) ?? null,
    storagePath: normalizeString(document.storagePath) ?? null,
    url: normalizeString(document.url) ?? null,
    uploadedAt: toIsoDateString(document.uploadedAt) ?? null,
    uploadedBy: normalizeString(document.uploadedBy) ?? null,
    status: document.status ?? "uploaded",
    metadata: toJsonObject(document.metadata),
  };
}

function mapDocuments(source: LegacyTenderSource): TenderDocumentRef[] {
  const documents = Array.isArray(source.documents) ? source.documents : [];
  return documents.map((document, index) => mapDocument(document, index));
}

function mapAnalysis(source: LegacyTenderSource, currency: string): TenderAnalysisSnapshot | null {
  const analysis = source.tenderAnalysis;

  if (!analysis) {
    return null;
  }

  return {
    issuingAuthority: normalizeString(analysis.issuingAuthority) ?? null,
    tenderNumber: normalizeString(analysis.tenderNumber) ?? normalizeString(source.tenderNumber) ?? null,
    scope: normalizeString(analysis.scope) ?? null,
    location: normalizeString(analysis.location) ?? null,
    estimatedValue: createMoney(analysis.estimatedValue, currency),
    aiAnalyzedAt: toIsoDateString(analysis.aiAnalyzedAt) ?? null,
    extractedRequirements: normalizeStringArray(analysis.requiredCertificates),
    metadata: undefined,
  };
}

function mapReadiness(source: LegacyTenderSource): TenderReadinessSnapshot | null {
  const readinessScore = normalizeNumber(source.readinessScore);
  const docsMissing = normalizeNumber(source.docsMissing);

  if (readinessScore === undefined && docsMissing === undefined && !source.tenderLockStatus) {
    return null;
  }

  return {
    readinessScore: readinessScore ?? 0,
    tenderLockStatus: source.tenderLockStatus ?? "BLOCKED",
    docsMissing: docsMissing ?? 0,
    missingRequirements: source.missingRequirements ?? [],
    complianceStatus:
      source.complianceMatch === true ? "PASS" : source.missingRequirements?.length ? "WARNING" : null,
    riskLevel: source.riskLevel ?? null,
    recommendations: source.missingRequirements?.length
      ? source.missingRequirements.map((item) => `Resolve requirement: ${item}`)
      : [],
    evaluatedAt: toIsoDateString(source.readinessUpdatedAt) ?? null,
  };
}

function mapPricing(source: LegacyTenderSource, currency: string): TenderPricingSnapshot | null {
  const value = createMoney(source.value, currency);
  const estimatedValue = createMoney(source.estimatedDealValue, currency);

  if (!source.pricingStatus && !source.assignedTo && !source.pricingApprovedAt && !value && !estimatedValue) {
    return null;
  }

  return {
    status: normalizeString(source.pricingStatus) ?? null,
    assignedTo: normalizeString(source.assignedTo) ?? null,
    approvedAt: toIsoDateString(source.pricingApprovedAt) ?? null,
    value,
    estimatedValue,
    metadata: undefined,
  };
}

function mapCompliance(source: LegacyTenderSource): TenderComplianceSnapshot | null {
  if (
    source.complianceMatch === undefined &&
    source.tenderLockStatus === undefined &&
    source.readinessScore === undefined &&
    source.docsMissing === undefined &&
    source.riskLevel === undefined &&
    source.missingRequirements === undefined
  ) {
    return null;
  }

  return {
    complianceMatch: source.complianceMatch ?? null,
    tenderLockStatus: source.tenderLockStatus ?? null,
    readinessScore: normalizeNumber(source.readinessScore) ?? null,
    docsMissing: normalizeNumber(source.docsMissing) ?? null,
    missingRequirements: source.missingRequirements ?? [],
    riskLevel: (source.riskLevel as TenderRiskLevel | undefined) ?? null,
    updatedAt: toIsoDateString(source.readinessUpdatedAt) ?? null,
    metadata: undefined,
  };
}

function mapAuditActor(actor: DealAuditEvent["actor"]): TenderAuditActor | null {
  if (!actor) {
    return null;
  }

  return {
    id: actor.uid,
    name: normalizeString(actor.name) ?? null,
    role: normalizeString(actor.role) ?? null,
    email: normalizeString(actor.email) ?? null,
  };
}

function mapAuditTrail(source: LegacyTenderSource): TenderAuditEvent[] {
  const auditTrail = Array.isArray(source.auditTrail) ? source.auditTrail : [];

  return auditTrail
    .map((event): TenderAuditEvent | null => {
      const createdAt = toIsoDateString(event.timestamp);
      if (!createdAt) {
        return null;
      }

      return {
        id: event.id,
        type: event.type,
        message: event.type.replace(/_/g, " "),
        createdAt,
        actor: mapAuditActor(event.actor),
        metadata: toJsonObject(event.meta),
      };
    })
    .filter((event): event is TenderAuditEvent => event !== null);
}

function buildMetadata(source: LegacyTenderSource): JsonObject | undefined {
  const metadata = toJsonObject(source.metadata) ?? {};
  const extraMetadata = toJsonObject({
    legacyStatus: source.status,
    legacyStage: source.stage,
    isTenderLocked: source.isTenderLocked,
    tenderSubmittedBy: source.tenderSubmittedBy,
    companyName: source.companyName,
    companyAddressLine1: source.companyAddressLine1,
    companyAddressLine2: source.companyAddressLine2,
    contactNumber: source.contactNumber,
    email: source.email,
    vatNumber: source.vatNumber,
    bbbee: source.bbbee,
    declarationName: source.declarationName,
    hasRelationship: source.hasRelationship,
    directors: source.directors,
  });

  return Object.keys({ ...metadata, ...extraMetadata }).length > 0
    ? { ...metadata, ...extraMetadata }
    : undefined;
}

function resolveStatus(source: LegacyTenderSource): TenderData["status"] {
  if (source.status === "submitted") {
    return "submitted";
  }

  if (source.status === "awarded") {
    return "awarded";
  }

  if (source.closedAt) {
    return "closed";
  }

  if (source.stage === "manager_review") {
    return "under_review";
  }

  return "draft";
}

/**
 * Example usage:
 * `const tenderData = mapLegacyTenderToTenderData(existingDeal);`
 */
export function mapLegacyTenderToTenderData(source: LegacyTenderSource): TenderData {
  const currency = resolveCurrency(source);
  const sourceYear = resolveSourceYear(source);
  const tenderId = normalizeString(source.tenderId) ?? normalizeString(source.id) ?? "unknown-tender";
  const legacyDealId = normalizeString(source.id) ?? null;
  const contractorId = normalizeString(source.contractorId) ?? normalizeString(source.companyId);
  const contractorName = normalizeString(source.contractorName);

  return {
    schemaVersion: "2026-01",
    schemaFamily: "TenderData",
    tenderId,
    legacyDealId,
    tenderNumber:
      normalizeString(source.tenderNumber) ?? normalizeString(source.tenderAnalysis?.tenderNumber) ?? null,
    title: normalizeString(source.tenderTitle) ?? normalizeString(source.title) ?? "Untitled Tender",
    description: normalizeString(source.description) ?? null,
    sourceYear,
    status: resolveStatus(source),
    stage: normalizeString(source.stage) ?? null,
    buyer: mapParty(normalizeString(source.buyerId), normalizeString(source.buyerName), "buyer"),
    contractor: mapParty(contractorId, contractorName, "contractor"),
    owner: mapParty(normalizeString(source.ownerId) ?? normalizeString(source.assignedTo), normalizeString(source.ownerName), "internal_owner"),
    value: createMoney(source.value, currency),
    estimatedValue: createMoney(source.estimatedDealValue, currency),
    timeline: {
      publishedAt: toIsoDateString(source.createdAt) ?? null,
      submissionDeadlineAt: toIsoDateString(source.tenderAnalysis?.deadline) ?? null,
      submittedAt: toIsoDateString(source.tenderSubmittedAt) ?? null,
      awardedAt: source.status === "awarded" ? toIsoDateString(source.updatedAt) ?? null : null,
      closedAt: toIsoDateString(source.closedAt) ?? null,
      createdAt: toIsoDateString(source.createdAt) ?? null,
      updatedAt: toIsoDateString(source.updatedAt) ?? null,
    },
    requirements: mapRequirements(source, sourceYear),
    documents: mapDocuments(source),
    pricing: mapPricing(source, currency),
    compliance: mapCompliance(source),
    readiness: mapReadiness(source),
    analysis: mapAnalysis(source, currency),
    tags: normalizeStringArray(source.tags),
    metadata: buildMetadata(source),
    auditTrail: mapAuditTrail(source),
  };
}

export function isTenderData(source: TenderDataSource): source is TenderData {
  return (
    typeof source === "object" &&
    source !== null &&
    "schemaFamily" in source &&
    "schemaVersion" in source &&
    (source as TenderData).schemaFamily === "TenderData"
  );
}

export function ensureTenderData(source: TenderDataSource): TenderData {
  return isTenderData(source) ? source : mapLegacyTenderToTenderData(source);
}

function getMetadataString(tenderData: TenderData, key: string): string | null {
  const value = tenderData.metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getMetadataDirectors(
  tenderData: TenderData
): Array<{ name: string; id: string; entity: string }> {
  const rawValue = tenderData.metadata?.directors;

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const name = typeof item.name === "string" ? item.name.trim() : "";
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const entity = typeof item.entity === "string" ? item.entity.trim() : "";

      if (!name && !id && !entity) {
        return null;
      }

      return {
        name,
        id,
        entity,
      };
    })
    .filter((item): item is { name: string; id: string; entity: string } => item !== null);
}

export function mapTenderDataToSBD1OverlayInput(tenderData: TenderData): SBD1OverlayInput {
  return {
    companyName:
      tenderData.contractor?.name ??
      getMetadataString(tenderData, "companyName") ??
      tenderData.title,
    companyAddressLine1: getMetadataString(tenderData, "companyAddressLine1"),
    companyAddressLine2: getMetadataString(tenderData, "companyAddressLine2"),
    contactNumber: getMetadataString(tenderData, "contactNumber"),
    email:
      getMetadataString(tenderData, "email") ??
      tenderData.owner?.externalReference ??
      null,
    vatNumber: getMetadataString(tenderData, "vatNumber"),
    bbbee: getMetadataString(tenderData, "bbbee"),
    generatedAt:
      (tenderData.timeline.updatedAt && new Date(tenderData.timeline.updatedAt)) ||
      (tenderData.timeline.createdAt && new Date(tenderData.timeline.createdAt)) ||
      undefined,
  };
}

export type SBD4OverlayInput = {
  directors: Array<{
    name: string;
    id: string;
    entity: string;
  }>;
  hasRelationship?: "YES" | "NO";
  declarationName?: string;
};

export function mapTenderDataToSBD4OverlayInput(tenderData: TenderData): SBD4OverlayInput {
  return {
    directors: getMetadataDirectors(tenderData),
    hasRelationship:
      getMetadataString(tenderData, "hasRelationship") === "YES" ? "YES" : "NO",
    declarationName:
      getMetadataString(tenderData, "declarationName") ??
      tenderData.owner?.name ??
      tenderData.contractor?.name ??
      undefined,
  };
}
