// src/types/opportunityIntelligence.ts
// Opportunity Intelligence Engine contracts only.

import type {
  Opportunity,
  OpportunityMoney,
  OpportunityPriority,
  OpportunityRiskLevel,
  OpportunitySourceType,
} from "@/types/opportunity";
import type { Contractor } from "@/types/contractor";

export type OpportunityIntelligenceSchemaVersion = "2026-01";

export type OpportunityIntelligenceSignalSource =
  | "opportunity_record"
  | "contractor_record"
  | "document_metadata"
  | "municipality_reference"
  | "historical_outcome"
  | "manual_input"
  | "external_registry";

export type OpportunityIntelligenceConfidence = "unknown" | "low" | "medium" | "high";

export type OpportunityMatchStatus = "not_evaluated" | "matched" | "partial_match" | "not_matched";
export type ContractorMatchStatus = "not_evaluated" | "eligible" | "conditional" | "ineligible";
export type ClosingDateUrgency = "unknown" | "future" | "soon" | "urgent" | "closed";
export type MunicipalityClassificationType =
  | "metropolitan"
  | "district"
  | "local"
  | "provincial"
  | "national"
  | "state_owned_entity"
  | "unknown";
export type TenderTypeClassification =
  | "rfq"
  | "tender"
  | "rfp"
  | "rfi"
  | "quotation"
  | "unknown";

export interface OpportunityIntelligenceEvidence {
  id: string;
  source: OpportunityIntelligenceSignalSource;
  label: string;
  referenceId?: string | null;
  fieldPath?: string | null;
  capturedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OpportunityIntelligenceScore {
  score: number | null;
  confidence: OpportunityIntelligenceConfidence;
  evidence: OpportunityIntelligenceEvidence[];
  missingInputs: string[];
  evaluatedAt?: string | null;
  version: OpportunityIntelligenceSchemaVersion;
}

export interface OpportunityOutcomeReference {
  id: string;
  sourceType?: OpportunitySourceType | null;
  municipalityName?: string | null;
  tenderType?: TenderTypeClassification | null;
  status?: "submitted" | "awarded" | "lost" | "cancelled" | "closed" | null;
  value?: OpportunityMoney | null;
  awardedAt?: string | null;
  closedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MunicipalityReference {
  id: string;
  name: string;
  classification?: MunicipalityClassificationType | null;
  province?: string | null;
  district?: string | null;
  region?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OpportunityIntelligenceContext {
  opportunity: Opportunity;
  contractors?: Contractor[];
  currentDate?: string;
  workspaceId?: string | null;
  historicalOutcomes?: OpportunityOutcomeReference[];
  municipalityReferences?: MunicipalityReference[];
  metadata?: Record<string, unknown>;
}

export interface OpportunityMatchingInput {
  opportunity: Opportunity;
  candidateOpportunities: Opportunity[];
  context?: OpportunityIntelligenceContext;
}

export interface OpportunityMatch {
  opportunityId: string;
  status: OpportunityMatchStatus;
  score: OpportunityIntelligenceScore;
  matchedFields: string[];
  unmatchedFields: string[];
}

export interface OpportunityMatchingResult {
  opportunityId: string;
  matches: OpportunityMatch[];
  evidence: OpportunityIntelligenceEvidence[];
}

export interface ContractorMatchingInput {
  opportunity: Opportunity;
  contractors: Contractor[];
  context?: OpportunityIntelligenceContext;
}

export interface ContractorMatch {
  contractorId: string;
  status: ContractorMatchStatus;
  score: OpportunityIntelligenceScore;
  eligibilityGaps: string[];
  assignmentRole?: string | null;
}

export interface ContractorMatchingResult {
  opportunityId: string;
  matches: ContractorMatch[];
  evidence: OpportunityIntelligenceEvidence[];
}

export interface ReadinessScoringInput {
  opportunity: Opportunity;
  contractorMatches?: ContractorMatch[];
  context?: OpportunityIntelligenceContext;
}

export interface ReadinessScoringResult extends OpportunityIntelligenceScore {
  readinessStatus: Opportunity["submissionReadiness"]["status"];
  requiredActions: string[];
}

export interface RiskScoringInput {
  opportunity: Opportunity;
  readiness?: ReadinessScoringResult;
  closingDate?: ClosingDateIntelligenceResult;
  context?: OpportunityIntelligenceContext;
}

export interface RiskScoringResult extends OpportunityIntelligenceScore {
  riskLevel: OpportunityRiskLevel | null;
  riskFactors: string[];
}

export interface WinProbabilityInput {
  opportunity: Opportunity;
  readiness?: ReadinessScoringResult;
  risk?: RiskScoringResult;
  context?: OpportunityIntelligenceContext;
}

export interface WinProbabilityResult extends OpportunityIntelligenceScore {
  probability: number | null;
}

export interface ExpectedRevenueInput {
  opportunity: Opportunity;
  winProbability?: WinProbabilityResult;
  context?: OpportunityIntelligenceContext;
}

export interface ExpectedRevenueResult extends OpportunityIntelligenceScore {
  expectedRevenue: OpportunityMoney | null;
  sourceValue: OpportunityMoney | null;
  probability: number | null;
}

export interface ClosingDateIntelligenceInput {
  opportunity: Opportunity;
  currentDate?: string;
  context?: OpportunityIntelligenceContext;
}

export interface ClosingDateIntelligenceResult extends OpportunityIntelligenceScore {
  closingDate: string | null;
  daysRemaining: number | null;
  urgency: ClosingDateUrgency;
  isClosed: boolean | null;
}

export interface OpportunityPriorityInput {
  opportunity: Opportunity;
  winProbability?: WinProbabilityResult;
  expectedRevenue?: ExpectedRevenueResult;
  closingDate?: ClosingDateIntelligenceResult;
  risk?: RiskScoringResult;
  context?: OpportunityIntelligenceContext;
}

export interface OpportunityPriorityResult extends OpportunityIntelligenceScore {
  priority: OpportunityPriority | null;
}

export interface MunicipalityClassificationInput {
  opportunity: Opportunity;
  municipalityReferences?: MunicipalityReference[];
  context?: OpportunityIntelligenceContext;
}

export interface MunicipalityClassificationResult extends OpportunityIntelligenceScore {
  municipalityName: string | null;
  classification: MunicipalityClassificationType;
  matchedReferenceId?: string | null;
}

export interface TenderTypeClassificationInput {
  opportunity: Opportunity;
  context?: OpportunityIntelligenceContext;
}

export interface TenderTypeClassificationResult extends OpportunityIntelligenceScore {
  tenderType: TenderTypeClassification;
  sourceType: OpportunitySourceType | null;
}

export interface OpportunityIntelligenceSnapshot {
  schemaVersion: OpportunityIntelligenceSchemaVersion;
  opportunityId: string;
  opportunityMatching?: OpportunityMatchingResult;
  contractorMatching?: ContractorMatchingResult;
  readinessScoring?: ReadinessScoringResult;
  winProbability?: WinProbabilityResult;
  priority?: OpportunityPriorityResult;
  riskScoring?: RiskScoringResult;
  expectedRevenue?: ExpectedRevenueResult;
  closingDateIntelligence?: ClosingDateIntelligenceResult;
  municipalityClassification?: MunicipalityClassificationResult;
  tenderTypeClassification?: TenderTypeClassificationResult;
  generatedAt?: string | null;
}

