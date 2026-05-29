import type { CompanyProfile, CompanyProfileFieldKey } from "@/lib/autofill/buildCompanyProfile";
import type { EngineDebugField } from "@/lib/empirePdf/templates";

export type ProfileCompletenessCategory =
  | "identity"
  | "compliance"
  | "contact"
  | "address"
  | "signatory"
  | "procurement";

export type CorrectionPriority = "critical" | "recommended" | "optional";
export type RendererHealth = "healthy" | "degraded" | "fallback_dependent" | "at_risk" | "unassessed";
export type ReadinessImpact = "none" | "low" | "moderate" | "high" | "blocking";
export type CategoryRendererImpact = "none" | "low" | "moderate" | "high";

export type ContractorProfileCategoryIntelligence = {
  category: ProfileCompletenessCategory;
  completeness: number;
  missingFields: CompanyProfileFieldKey[];
  criticalMissingFields: CompanyProfileFieldKey[];
  rendererImpact: CategoryRendererImpact;
  confidenceImpact: number;
};

export type ContractorProfileCorrection = {
  field: CompanyProfileFieldKey;
  label: string;
  priority: CorrectionPriority;
  category: ProfileCompletenessCategory;
  reason: string;
  rendererSignals: {
    lowConfidence: boolean;
    fallbackUsed: boolean;
    overflowDetected: boolean;
  };
};

export type ContractorProfileIntelligence = {
  overallCompleteness: number;
  readinessImpact: ReadinessImpact;
  rendererHealth: RendererHealth;
  missingCriticalFields: CompanyProfileFieldKey[];
  recommendedCorrections: ContractorProfileCorrection[];
  overflowRiskFields: string[];
  lowConfidenceFields: string[];
  categories: Record<ProfileCompletenessCategory, ContractorProfileCategoryIntelligence>;
  telemetry: {
    contractorId: string;
    categoryCount: number;
    criticalGapCount: number;
    fallbackFieldCount: number;
    lowConfidenceFieldCount: number;
    overflowRiskCount: number;
    averageRendererConfidence: number | null;
  };
};

type ContractorFieldConfig = {
  key: CompanyProfileFieldKey;
  label: string;
  category: ProfileCompletenessCategory;
  weight: number;
  priority: CorrectionPriority;
};

type FieldSignalSummary = {
  relatedFields: EngineDebugField[];
  lowConfidence: boolean;
  fallbackUsed: boolean;
  overflowDetected: boolean;
  renderFailure: boolean;
  averageConfidence: number | null;
  missingDependency: boolean;
  sourceFallback: boolean;
};

const FIELD_CONFIGS: ContractorFieldConfig[] = [
  { key: "companyName", label: "Company name", category: "identity", weight: 14, priority: "critical" },
  { key: "regNumber", label: "Registration number", category: "identity", weight: 14, priority: "critical" },
  { key: "directors", label: "Directors", category: "identity", weight: 8, priority: "recommended" },
  { key: "vatNumber", label: "VAT number", category: "compliance", weight: 8, priority: "recommended" },
  { key: "taxPin", label: "Tax PIN", category: "compliance", weight: 14, priority: "critical" },
  { key: "csdNumber", label: "CSD number", category: "compliance", weight: 10, priority: "recommended" },
  { key: "cidb", label: "CIDB number", category: "compliance", weight: 4, priority: "optional" },
  { key: "bbbeeLevel", label: "B-BBEE level", category: "compliance", weight: 4, priority: "optional" },
  { key: "bbbeeIssueDate", label: "B-BBEE issue date", category: "compliance", weight: 2, priority: "optional" },
  { key: "contactPerson", label: "Contact person", category: "contact", weight: 10, priority: "critical" },
  { key: "email", label: "Email", category: "contact", weight: 10, priority: "recommended" },
  { key: "phone", label: "Phone", category: "contact", weight: 8, priority: "recommended" },
  { key: "address", label: "Primary address", category: "address", weight: 8, priority: "recommended" },
  { key: "postalAddress", label: "Postal address", category: "address", weight: 6, priority: "recommended" },
  { key: "streetAddress", label: "Street address", category: "address", weight: 6, priority: "recommended" },
  { key: "country", label: "Country", category: "address", weight: 3, priority: "optional" },
  { key: "directorName", label: "Signatory name", category: "signatory", weight: 10, priority: "recommended" },
  { key: "signatoryRole", label: "Signatory role", category: "signatory", weight: 8, priority: "recommended" },
  { key: "bankingDetails", label: "Banking details", category: "procurement", weight: 8, priority: "recommended" },
  { key: "businessType", label: "Business type", category: "procurement", weight: 6, priority: "optional" },
  { key: "bbbeeStatus", label: "B-BBEE status", category: "procurement", weight: 3, priority: "optional" },
];

const CATEGORY_ORDER: ProfileCompletenessCategory[] = [
  "identity",
  "compliance",
  "contact",
  "address",
  "signatory",
  "procurement",
];

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function getFieldConfig(key: CompanyProfileFieldKey): ContractorFieldConfig {
  return FIELD_CONFIGS.find((config) => config.key === key) ?? {
    key,
    label: key,
    category: "procurement",
    weight: 1,
    priority: "optional",
  };
}

function normalizeProfileFieldKey(value: string): CompanyProfileFieldKey | null {
  const normalized = value.replace(/^contractor\./, "").trim();
  const match = FIELD_CONFIGS.find((config) => config.key === normalized);
  return match?.key ?? null;
}

function getProfileValue(profile: CompanyProfile, key: CompanyProfileFieldKey): string {
  const value = profile[key];
  return typeof value === "string" ? value.trim() : "";
}

function collectFieldSignals(
  field: CompanyProfileFieldKey,
  rendererFields: EngineDebugField[]
): FieldSignalSummary {
  const relatedFields = rendererFields.filter(
    (rendererField) =>
      normalizeProfileFieldKey(rendererField.sourceField) === field ||
      rendererField.missingDependencies.includes(field)
  );
  const lowConfidenceFields = relatedFields.filter((rendererField) => rendererField.confidence < 0.7);
  const fallbackFields = relatedFields.filter((rendererField) => rendererField.fallbackUsed);
  const overflowFields = relatedFields.filter(
    (rendererField) =>
      rendererField.overflowDetected || rendererField.multilineOverflowDetected || rendererField.clippingRisk
  );
  const renderFailures = relatedFields.filter((rendererField) => !rendererField.renderSuccess);
  const confidenceSamples = relatedFields.map((rendererField) => rendererField.confidence).filter((value) => value > 0);
  const missingDependency = relatedFields.some((rendererField) => rendererField.missingDependencies.includes(field));
  const sourceFallback = relatedFields.some((rendererField) => {
    const sourceFieldKey = normalizeProfileFieldKey(rendererField.sourceField);
    return sourceFieldKey === field && rendererField.sourceField.startsWith("semantic.");
  });

  return {
    relatedFields,
    lowConfidence: lowConfidenceFields.length > 0,
    fallbackUsed: fallbackFields.length > 0,
    overflowDetected: overflowFields.length > 0,
    renderFailure: renderFailures.length > 0,
    averageConfidence:
      confidenceSamples.length > 0
        ? Number((confidenceSamples.reduce((sum, value) => sum + value, 0) / confidenceSamples.length).toFixed(2))
        : null,
    missingDependency,
    sourceFallback,
  };
}

function getPresenceFactor(
  profile: CompanyProfile,
  field: CompanyProfileFieldKey,
  signals: FieldSignalSummary
): number {
  const value = getProfileValue(profile, field);
  const sourceAttribution = profile.sourceAttribution[field];

  if (!value) {
    return signals.missingDependency ? 0.35 : 0;
  }

  let factor = 1;

  if (sourceAttribution === "document-ai") {
    factor -= 0.08;
  }

  if (sourceAttribution === "default") {
    factor -= 0.35;
  }

  if (signals.missingDependency) {
    factor = Math.min(factor, 0.55);
  }

  if (signals.sourceFallback) {
    factor = Math.min(factor, 0.6);
  }

  if (signals.fallbackUsed) {
    factor -= 0.08;
  }

  if (signals.averageConfidence !== null && signals.averageConfidence < 0.7) {
    factor -= 0.15;
  }

  return Math.max(0, Math.min(1, Number(factor.toFixed(2))));
}

function resolveRendererImpact(signals: FieldSignalSummary[]): CategoryRendererImpact {
  const severityScore = signals.reduce((sum, signal) => {
    let next = sum;
    if (signal.lowConfidence) {
      next += 1;
    }
    if (signal.fallbackUsed) {
      next += 1.5;
    }
    if (signal.overflowDetected) {
      next += 1.5;
    }
    if (signal.renderFailure) {
      next += 2;
    }
    if (signal.missingDependency) {
      next += 1;
    }
    return next;
  }, 0);

  if (severityScore === 0) {
    return "none";
  }

  if (severityScore < 2) {
    return "low";
  }

  if (severityScore < 5) {
    return "moderate";
  }

  return "high";
}

function resolveReadinessImpact(params: {
  overallCompleteness: number;
  criticalGapCount: number;
  rendererHealth: RendererHealth;
  lowConfidenceFieldCount: number;
}): ReadinessImpact {
  if (params.criticalGapCount >= 2 || params.overallCompleteness < 55 || params.rendererHealth === "at_risk") {
    return "blocking";
  }

  if (params.criticalGapCount === 1 || params.overallCompleteness < 70 || params.rendererHealth === "fallback_dependent") {
    return "high";
  }

  if (params.lowConfidenceFieldCount > 0 || params.rendererHealth === "degraded" || params.overallCompleteness < 85) {
    return "moderate";
  }

  if (params.overallCompleteness < 95) {
    return "low";
  }

  return "none";
}

function resolveRendererHealth(rendererFields: EngineDebugField[]): {
  rendererHealth: RendererHealth;
  fallbackFieldCount: number;
  lowConfidenceFieldCount: number;
  overflowRiskCount: number;
  averageRendererConfidence: number | null;
} {
  if (rendererFields.length === 0) {
    return {
      rendererHealth: "unassessed",
      fallbackFieldCount: 0,
      lowConfidenceFieldCount: 0,
      overflowRiskCount: 0,
      averageRendererConfidence: null,
    };
  }

  const fallbackFieldCount = rendererFields.filter((field) => field.fallbackUsed).length;
  const lowConfidenceFieldCount = rendererFields.filter((field) => field.confidence < 0.7).length;
  const overflowRiskCount = rendererFields.filter(
    (field) => field.overflowDetected || field.multilineOverflowDetected || field.clippingRisk
  ).length;
  const renderFailures = rendererFields.filter((field) => !field.renderSuccess).length;
  const averageRendererConfidence = Number(
    (
      rendererFields.reduce((sum, field) => sum + field.confidence, 0) / Math.max(rendererFields.length, 1)
    ).toFixed(2)
  );

  const rendererHealth: RendererHealth =
    renderFailures > 0 || averageRendererConfidence < 0.55
      ? "at_risk"
      : fallbackFieldCount >= 2 || overflowRiskCount > 0
        ? "fallback_dependent"
        : lowConfidenceFieldCount > 0 || averageRendererConfidence < 0.8
          ? "degraded"
          : "healthy";

  return {
    rendererHealth,
    fallbackFieldCount,
    lowConfidenceFieldCount,
    overflowRiskCount,
    averageRendererConfidence,
  };
}

export function buildContractorProfileIntelligence(params: {
  contractorId: string;
  profile: CompanyProfile;
  rendererFields?: EngineDebugField[];
}): ContractorProfileIntelligence {
  const rendererFields = params.rendererFields ?? [];
  const categoryState = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [
      category,
      {
        category,
        completeness: 0,
        missingFields: [] as CompanyProfileFieldKey[],
        criticalMissingFields: [] as CompanyProfileFieldKey[],
        rendererImpact: "none" as CategoryRendererImpact,
        confidenceImpact: 0,
      },
    ])
  ) as Record<ProfileCompletenessCategory, ContractorProfileCategoryIntelligence>;
  const signalsByField = new Map<CompanyProfileFieldKey, FieldSignalSummary>();
  const corrections: ContractorProfileCorrection[] = [];
  let weightedTotal = 0;
  let weightedPresent = 0;

  for (const fieldConfig of FIELD_CONFIGS) {
    const signals = collectFieldSignals(fieldConfig.key, rendererFields);
    signalsByField.set(fieldConfig.key, signals);

    const presenceFactor = getPresenceFactor(params.profile, fieldConfig.key, signals);
    const category = categoryState[fieldConfig.category];
    const rawValue = getProfileValue(params.profile, fieldConfig.key);
    const effectivelyMissing = presenceFactor < 0.99;
    const criticalMissing = fieldConfig.priority === "critical" && rawValue.length === 0;

    weightedTotal += fieldConfig.weight;
    weightedPresent += fieldConfig.weight * presenceFactor;

    if (effectivelyMissing) {
      category.missingFields.push(fieldConfig.key);
      if (criticalMissing) {
        category.criticalMissingFields.push(fieldConfig.key);
      }

      const reason = rawValue.length === 0
        ? `${fieldConfig.label} is missing from the contractor profile`
        : signals.missingDependency
          ? `${fieldConfig.label} is being inferred through another field, which lowers renderer precision`
          : signals.lowConfidence
            ? `${fieldConfig.label} is present but still resolving with low renderer confidence`
            : `${fieldConfig.label} needs refinement for reliable tender rendering`;

      corrections.push({
        field: fieldConfig.key,
        label: fieldConfig.label,
        priority: fieldConfig.priority,
        category: fieldConfig.category,
        reason,
        rendererSignals: {
          lowConfidence: signals.lowConfidence,
          fallbackUsed: signals.fallbackUsed,
          overflowDetected: signals.overflowDetected,
        },
      });
    }
  }

  for (const category of CATEGORY_ORDER) {
    const fields = FIELD_CONFIGS.filter((field) => field.category === category);
    const categoryWeight = fields.reduce((sum, field) => sum + field.weight, 0);
    const categoryPresent = fields.reduce((sum, field) => {
      const signals = signalsByField.get(field.key) ?? collectFieldSignals(field.key, rendererFields);
      return sum + field.weight * getPresenceFactor(params.profile, field.key, signals);
    }, 0);
    const categorySignals = fields.map((field) => signalsByField.get(field.key) ?? collectFieldSignals(field.key, rendererFields));
    const confidenceSamples = categorySignals
      .map((signal) => signal.averageConfidence)
      .filter((value): value is number => typeof value === "number");

    categoryState[category].completeness =
      categoryWeight > 0 ? clampPercent((categoryPresent / categoryWeight) * 100) : 100;
    categoryState[category].rendererImpact = resolveRendererImpact(categorySignals);
    categoryState[category].confidenceImpact =
      confidenceSamples.length > 0
        ? clampPercent((1 - confidenceSamples.reduce((sum, value) => sum + value, 0) / confidenceSamples.length) * 100)
        : 0;
  }

  const overallCompleteness = weightedTotal > 0 ? clampPercent((weightedPresent / weightedTotal) * 100) : 100;
  const rendererState = resolveRendererHealth(rendererFields);
  const missingCriticalFields = FIELD_CONFIGS.filter(
    (field) => field.priority === "critical" && getProfileValue(params.profile, field.key).length === 0
  ).map((field) => field.key);
  const lowConfidenceFields = uniqueStrings(
    rendererFields.filter((field) => field.confidence < 0.7).map((field) => field.fieldKey)
  );
  const overflowRiskFields = uniqueStrings(
    rendererFields
      .filter((field) => field.overflowDetected || field.multilineOverflowDetected || field.clippingRisk)
      .map((field) => field.fieldKey)
  );
  const recommendedCorrections = corrections.sort((left, right) => {
    const priorityRank: Record<CorrectionPriority, number> = {
      critical: 0,
      recommended: 1,
      optional: 2,
    };
    const priorityDelta = priorityRank[left.priority] - priorityRank[right.priority];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const leftConfig = getFieldConfig(left.field);
    const rightConfig = getFieldConfig(right.field);
    return rightConfig.weight - leftConfig.weight;
  });
  const readinessImpact = resolveReadinessImpact({
    overallCompleteness,
    criticalGapCount: missingCriticalFields.length,
    rendererHealth: rendererState.rendererHealth,
    lowConfidenceFieldCount: rendererState.lowConfidenceFieldCount,
  });

  return {
    overallCompleteness,
    readinessImpact,
    rendererHealth: rendererState.rendererHealth,
    missingCriticalFields,
    recommendedCorrections,
    overflowRiskFields,
    lowConfidenceFields,
    categories: categoryState,
    telemetry: {
      contractorId: params.contractorId,
      categoryCount: CATEGORY_ORDER.length,
      criticalGapCount: missingCriticalFields.length,
      fallbackFieldCount: rendererState.fallbackFieldCount,
      lowConfidenceFieldCount: rendererState.lowConfidenceFieldCount,
      overflowRiskCount: rendererState.overflowRiskCount,
      averageRendererConfidence: rendererState.averageRendererConfidence,
    },
  };
}
