import type { Deal } from "@/types/deal";
import { normalizeDocsMissingCount } from "@/lib/compliance/contractorCompliance";

function normalizeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeStage(stage: unknown): Deal["stage"] {
  const allowed: Deal["stage"][] = [
    "draft",
    "lead",
    "in_review",
    "pricing",
    "manager_review",
    "submitted",
    "awarded",
    "won",
    "rejected",
    "lost",
    "closed",
  ];

  return allowed.includes(stage as Deal["stage"]) ? (stage as Deal["stage"]) : "lead";
}

function normalizePricingStatus(status: unknown): Deal["pricingStatus"] {
  const allowed = ["not_started", "in_progress", "manager_approved", "rejected"];
  return allowed.includes(status as string) ? (status as Deal["pricingStatus"]) : "not_started";
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return normalized.length > 0 ? normalized : [];
}

function normalizeTenderAnalysis(value: unknown): Deal["tenderAnalysis"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  return {
    issuingAuthority: normalizeOptionalString(source.issuingAuthority) ?? null,
    tenderNumber: normalizeOptionalString(source.tenderNumber) ?? null,
    deadline: normalizeOptionalString(source.deadline) ?? null,
    scope: normalizeOptionalString(source.scope) ?? null,
    requiredCertificates: normalizeStringArray(source.requiredCertificates) ?? [],
    estimatedValue: typeof source.estimatedValue === "number" && Number.isFinite(source.estimatedValue)
      ? source.estimatedValue
      : null,
    location: normalizeOptionalString(source.location) ?? null,
    aiAnalyzedAt: normalizeOptionalString(source.aiAnalyzedAt) ?? null,
  };
}

export function resolveTenderLockStatus(
  score: number,
  docsMissing: number,
  value: unknown
): NonNullable<Deal["tenderLockStatus"]> {
  if (value === "READY" || value === "RISK" || value === "BLOCKED") {
    return value;
  }

  if (score < 60) {
    return "BLOCKED";
  }

  if (score < 80) {
    return "RISK";
  }

  return "READY";
}

export function normalizeDeal(id: string, source: Record<string, unknown>): Deal {
  const readinessScore = normalizeNumber(source.readinessScore);
  const docsMissing = normalizeDocsMissingCount(source.docsMissing);
  const contractorId =
    normalizeOptionalString(source.contractorId) ?? normalizeOptionalString(source.companyId);
  const contractorName =
    normalizeOptionalString(source.contractorName) ??
    normalizeOptionalString(source.companyName) ??
    contractorId;

  return {
    id,
    type: normalizeOptionalString(source.type),
    templateOverride:
      source.templateOverride === null
        ? null
        : normalizeStringArray(source.templateOverride),
    title: normalizeOptionalString(source.title) ?? "Untitled",
    companyId: normalizeOptionalString(source.companyId) ?? contractorId ?? "unknown",
    contractorId,
    contractorName,
    status:
      source.status === "submitted" || source.status === "awarded" ? source.status : "draft",
    stage: normalizeStage(source.stage),
    pricingStatus: normalizePricingStatus(source.pricingStatus),
    value: normalizeNumber(source.value),
    assignedTo: normalizeOptionalString(source.assignedTo) ?? null,
    createdAt: (source.createdAt as Deal["createdAt"]) ?? Date.now(),
    updatedAt: source.updatedAt as Deal["updatedAt"],
    closedAt: source.closedAt as Deal["closedAt"],
    isTenderLocked: normalizeBoolean(source.isTenderLocked) || docsMissing > 0 || readinessScore < 60,
    readinessScore,
    docsMissing,
    tenderLockStatus: resolveTenderLockStatus(readinessScore, docsMissing, source.tenderLockStatus),
    readinessUpdatedAt: normalizeOptionalString(source.readinessUpdatedAt),
    tenderSubmittedAt: source.tenderSubmittedAt as Deal["tenderSubmittedAt"],
    tenderSubmittedBy: normalizeOptionalString(source.tenderSubmittedBy),
    complianceMatch: source.complianceMatch === true,
    missingRequirements: normalizeStringArray(source.missingRequirements) ?? [],
    riskLevel:
      source.riskLevel === "LOW" ||
      source.riskLevel === "MEDIUM" ||
      source.riskLevel === "HIGH" ||
      source.riskLevel === "CRITICAL"
        ? source.riskLevel
        : undefined,
    estimatedDealValue: normalizeOptionalNumber(source.estimatedDealValue),
    tenderAnalysis: normalizeTenderAnalysis(source.tenderAnalysis),
  };
}
