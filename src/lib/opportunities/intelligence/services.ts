import type {
  ClosingDateIntelligenceInput,
  ClosingDateIntelligenceResult,
  ContractorMatchingInput,
  ContractorMatchingResult,
  ExpectedRevenueInput,
  ExpectedRevenueResult,
  MunicipalityClassificationInput,
  MunicipalityClassificationResult,
  OpportunityIntelligenceContext,
  OpportunityIntelligenceSnapshot,
  OpportunityMatchingInput,
  OpportunityMatchingResult,
  OpportunityPriorityInput,
  OpportunityPriorityResult,
  ReadinessScoringInput,
  ReadinessScoringResult,
  RiskScoringInput,
  RiskScoringResult,
  TenderTypeClassificationInput,
  TenderTypeClassificationResult,
  WinProbabilityInput,
  WinProbabilityResult,
} from "@/types/opportunityIntelligence";

export interface OpportunityMatchingService {
  matchOpportunities(input: OpportunityMatchingInput): Promise<OpportunityMatchingResult>;
}

export interface ContractorMatchingService {
  matchContractors(input: ContractorMatchingInput): Promise<ContractorMatchingResult>;
}

export interface ReadinessScoringService {
  scoreReadiness(input: ReadinessScoringInput): Promise<ReadinessScoringResult>;
}

export interface WinProbabilityService {
  calculateWinProbability(input: WinProbabilityInput): Promise<WinProbabilityResult>;
}

export interface OpportunityPriorityService {
  classifyPriority(input: OpportunityPriorityInput): Promise<OpportunityPriorityResult>;
}

export interface RiskScoringService {
  scoreRisk(input: RiskScoringInput): Promise<RiskScoringResult>;
}

export interface ExpectedRevenueService {
  calculateExpectedRevenue(input: ExpectedRevenueInput): Promise<ExpectedRevenueResult>;
}

export interface ClosingDateIntelligenceService {
  evaluateClosingDate(input: ClosingDateIntelligenceInput): Promise<ClosingDateIntelligenceResult>;
}

export interface MunicipalityClassificationService {
  classifyMunicipality(input: MunicipalityClassificationInput): Promise<MunicipalityClassificationResult>;
}

export interface TenderTypeClassificationService {
  classifyTenderType(input: TenderTypeClassificationInput): Promise<TenderTypeClassificationResult>;
}

export interface OpportunityIntelligenceEngineServices {
  opportunityMatching: OpportunityMatchingService;
  contractorMatching: ContractorMatchingService;
  readinessScoring: ReadinessScoringService;
  winProbability: WinProbabilityService;
  opportunityPriority: OpportunityPriorityService;
  riskScoring: RiskScoringService;
  expectedRevenue: ExpectedRevenueService;
  closingDateIntelligence: ClosingDateIntelligenceService;
  municipalityClassification: MunicipalityClassificationService;
  tenderTypeClassification: TenderTypeClassificationService;
}

export interface OpportunityIntelligenceEngine {
  evaluate(context: OpportunityIntelligenceContext): Promise<OpportunityIntelligenceSnapshot>;
}

