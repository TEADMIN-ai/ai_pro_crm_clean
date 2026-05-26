import type {
  AuthorityClassification,
  DivergenceClassification,
  MutationClassification,
  RouteClassification,
} from "@/lib/governance/classification";

export type GovernanceEventCategory =
  | "route_invocation"
  | "route_completion"
  | "legacy_mutation"
  | "ai_analysis"
  | "verification"
  | "recomputation"
  | "divergence_observation"
  | "analytics_summary"
  | "governance_alert";

export type GovernanceActorSummary = {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
};

export type GovernanceSourceSummary = {
  sourceType: "route" | "service";
  sourceName: string;
  routePath?: string | null;
  method?: string | null;
  sourceClassification?: RouteClassification | null;
};

export type GovernanceEntitySummary = {
  entityType?: string | null;
  entityId?: string | null;
  contractorId?: string | null;
  dealId?: string | null;
  documentType?: string | null;
};

export type GovernanceMutationSummary = {
  mutationType?: MutationClassification | null;
  mutatedFields?: string[];
};

export type GovernanceSummary = {
  routeClassification?: RouteClassification | null;
  sourceClassification?: RouteClassification | null;
  authorityClassification?: AuthorityClassification | null;
  latencyMs?: number | null;
  failOpen?: boolean;
};

export type GovernanceAiSummary = {
  aiStatus?: string | null;
  validationStatus?: string | null;
  confidenceScore?: number | null;
  warnings?: string[];
  failureReason?: string | null;
};

export type GovernanceComparisonSummary = {
  comparedFields?: string[];
  divergenceFields?: string[];
  divergenceClassification?: DivergenceClassification | null;
  staleStateDetected?: boolean;
  changedState?: boolean;
};

export type GovernanceAnalyticsSummary = {
  counterName?: string | null;
  counterValue?: number | null;
  eventCategory?: GovernanceEventCategory | null;
  summaryType?: "activity" | "divergence" | "correction" | "route_activity" | null;
  aggregationKey?: string | null;
  aggregatedAt?: string | null;
};

export type GovernanceEvent = {
  eventId: string;
  eventVersion: "v1";
  occurredAt: string;
  category: GovernanceEventCategory;
  eventType: string;
  correlation: {
    correlationId: string;
    requestId: string;
  };
  actor?: GovernanceActorSummary;
  source: GovernanceSourceSummary;
  entity?: GovernanceEntitySummary;
  mutation?: GovernanceMutationSummary;
  governance: GovernanceSummary;
  ai?: GovernanceAiSummary;
  comparison?: GovernanceComparisonSummary;
  analytics?: GovernanceAnalyticsSummary;
};
