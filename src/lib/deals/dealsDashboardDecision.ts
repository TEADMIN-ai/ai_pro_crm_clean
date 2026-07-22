export type DashboardDecisionStatus = "ALLOWED" | "BLOCKED" | "UNKNOWN" | "UNRESOLVED" | "DATA_ERROR";

export type DashboardMatchDecision = {
  contractorId?: string | null;
  contractorName?: string | null;
  eligible?: boolean;
  assignmentAllowed?: boolean;
  blockingReasons?: string[];
  recommendationReason?: string | null;
  submissionReadiness?: number;
  complianceStatus?: string | null;
};

export type DashboardProjectionDecision = {
  decisionStatus?: DashboardDecisionStatus | string | null;
  readinessStatus?: string | null;
  readinessScore?: number | null;
  submissionReadiness?: number | null;
  assignmentAllowed?: boolean;
  eligible?: boolean;
  blockingReasons?: string[];
  complianceStatus?: string | null;
  contractorId?: string | null;
  contractorName?: string | null;
};

export type DashboardDealDecisionInput = {
  deal?: { contractorId?: string | null; contractorReferenceResolution?: { status?: string | null } | null; readinessScore?: number | null } | null;
  projection?: DashboardProjectionDecision | null;
  selectedMatch?: DashboardMatchDecision | null;
};

export type DashboardDealDecision = {
  status: DashboardDecisionStatus;
  readinessLabel: string;
  readinessScore: number | null;
  complianceLabel: string;
  contractorIdentityLabel: string;
  assignmentAllowed: boolean;
  eligible: boolean;
  blockingReasons: string[];
  primaryBlockingReason: string;
  recommendationText: string | null;
  canGeneratePack: boolean;
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function hasPositiveGenericRecommendation(value: string | null): boolean {
  return Boolean(value && /ready|matched|recommended|valid|assignable|compliant/i.test(value));
}

export function buildDealsDashboardDecision(input: DashboardDealDecisionInput): DashboardDealDecision {
  const projection = input.projection ?? null;
  const selectedMatch = input.selectedMatch ?? null;
  const blockers = unique([...(projection?.blockingReasons ?? []), ...(selectedMatch?.blockingReasons ?? [])]);
  const contractorResolved = Boolean(clean(projection?.contractorId) ?? clean(input.deal?.contractorId));
  const contractorIdentityUnresolved = input.deal?.contractorReferenceResolution?.status === "unresolved" || !contractorResolved;
  const complianceStatus = clean(projection?.complianceStatus ?? selectedMatch?.complianceStatus);
  const complianceValid = complianceStatus === "VALID";
  const readinessStatus = clean(projection?.readinessStatus);
  const explicitAllowed = projection?.assignmentAllowed === true || selectedMatch?.assignmentAllowed === true;
  const eligible = projection?.eligible === true || selectedMatch?.eligible === true;
  const score = typeof projection?.readinessScore === "number" ? projection.readinessScore : null;
  const readyVerified = readinessStatus === "READY" && score !== null && blockers.length === 0 && eligible;
  const nextBlockers = [...blockers];
  if (contractorIdentityUnresolved) nextBlockers.unshift("Contractor identity unresolved");
  if (!complianceValid) nextBlockers.push("Compliance evidence unavailable");
  if (!readyVerified) nextBlockers.push("Readiness not verified");
  const blockingReasons = unique(nextBlockers);
  const recommendation = clean(selectedMatch?.recommendationReason);
  const recommendationText = blockingReasons.length && hasPositiveGenericRecommendation(recommendation) ? null : recommendation;
  const status: DashboardDecisionStatus = contractorIdentityUnresolved ? "UNRESOLVED" : blockingReasons.length ? "BLOCKED" : readyVerified ? "ALLOWED" : "UNKNOWN";
  return {
    status,
    readinessLabel: readyVerified ? "Readiness verified" : "Readiness not verified",
    readinessScore: readyVerified ? score : null,
    complianceLabel: complianceValid ? "Compliance verified" : "Compliance evidence unavailable",
    contractorIdentityLabel: contractorIdentityUnresolved ? "Contractor identity unresolved" : "Contractor identity resolved",
    assignmentAllowed: explicitAllowed && eligible && blockingReasons.length === 0,
    eligible: eligible && blockingReasons.length === 0,
    blockingReasons,
    primaryBlockingReason: blockingReasons[0] ?? "No blocker",
    recommendationText,
    canGeneratePack: explicitAllowed && eligible && readyVerified && complianceValid && !contractorIdentityUnresolved,
  };
}

export function findDashboardMatch(matches: DashboardMatchDecision[], contractorId: string): DashboardMatchDecision | null {
  const normalized = contractorId.trim();
  return normalized ? matches.find((match) => clean(match.contractorId) === normalized) ?? null : null;
}
