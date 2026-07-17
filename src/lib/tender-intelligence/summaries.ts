import type {
  TenderIntelligence,
  TenderIntelligenceExecutionHandoff,
  TenderSummaryConclusion,
} from "@/types/tenderIntelligence";
import { conclusion } from "./detection";

export function buildExecutiveSummary(input: {
  title: string | null;
  issuer: string | null;
  closingAt: string | null;
  deliveryLocation: string | null;
  briefingCompulsory: boolean | null;
  eligibilityRequirements: TenderSummaryConclusion[];
  compulsoryCompliance: TenderSummaryConclusion[];
  pricingRequirement: string | null;
  boqLocation: string | null;
  disqualificationRisks: TenderSummaryConclusion[];
  nextAction: string;
}): TenderSummaryConclusion[] {
  return [
    conclusion("What is being procured", input.title),
    conclusion("Issuer", input.issuer),
    conclusion("Closing date and time", input.closingAt),
    conclusion("Delivery requirement", input.deliveryLocation),
    conclusion("Compulsory briefing", input.briefingCompulsory === null ? null : input.briefingCompulsory ? "Compulsory briefing required" : "No compulsory briefing confirmed"),
    conclusion("Key eligibility requirements", input.eligibilityRequirements.map((item) => item.value).join("; ") || null, input.eligibilityRequirements.flatMap((item) => item.evidence)),
    conclusion("Major compliance requirements", input.compulsoryCompliance.map((item) => item.value).join("; ") || null, input.compulsoryCompliance.flatMap((item) => item.evidence)),
    conclusion("Pricing requirement", input.pricingRequirement),
    conclusion("BOQ/pricing schedule location", input.boqLocation),
    conclusion("Key commercial risks", input.disqualificationRisks.map((item) => item.value).join("; ") || null, input.disqualificationRisks.flatMap((item) => item.evidence)),
    conclusion("Immediate next action", input.nextAction),
  ];
}

export function buildDetailedSubmissionSummary(input: Pick<
  TenderIntelligence,
  | "detailedScope"
  | "closingAt"
  | "briefingDate"
  | "deliveryDeadline"
  | "requiredReturnables"
  | "compulsoryCompliance"
  | "evaluationCriteria"
  | "functionalityCriteria"
  | "preferencePointSystem"
  | "signaturesRequired"
  | "submissionMethod"
  | "submissionAddress"
  | "disqualificationRisks"
  | "unresolvedQuestions"
  | "sourceEvidence"
>): TenderSummaryConclusion[] {
  return [
    conclusion("Full scope", input.detailedScope, input.sourceEvidence),
    conclusion("All deadlines", [input.closingAt, input.briefingDate, input.deliveryDeadline].filter(Boolean).join("; ") || null),
    conclusion("Compulsory returnables", input.requiredReturnables.map((item) => item.value).join("; ") || null, input.requiredReturnables.flatMap((item) => item.evidence)),
    conclusion("Compliance requirements", input.compulsoryCompliance.map((item) => item.value).join("; ") || null, input.compulsoryCompliance.flatMap((item) => item.evidence)),
    conclusion("Technical requirements", input.functionalityCriteria.map((item) => item.value).join("; ") || input.detailedScope, input.functionalityCriteria.flatMap((item) => item.evidence)),
    conclusion("Commercial requirements", input.evaluationCriteria.map((item) => item.value).join("; ") || null, input.evaluationCriteria.flatMap((item) => item.evidence)),
    conclusion("Evaluation methodology", input.evaluationCriteria.map((item) => item.value).join("; ") || null, input.evaluationCriteria.flatMap((item) => item.evidence)),
    conclusion("Preference point system", input.preferencePointSystem),
    conclusion("Forms and signatures", input.signaturesRequired.map((item) => item.value).join("; ") || null, input.signaturesRequired.flatMap((item) => item.evidence)),
    conclusion("Submission method", [input.submissionMethod, input.submissionAddress].filter(Boolean).join(" - ") || null),
    conclusion("Disqualification risks", input.disqualificationRisks.map((item) => item.value).join("; ") || null, input.disqualificationRisks.flatMap((item) => item.evidence)),
    conclusion("Unresolved issues", input.unresolvedQuestions.map((item) => item.value).join("; ") || "No unresolved issues recorded", input.unresolvedQuestions.flatMap((item) => item.evidence)),
    conclusion("Staff actions required", input.unresolvedQuestions.length ? "Resolve unresolved issues and approve intelligence before pricing handoff" : "Approve tender intelligence before pricing handoff"),
  ];
}

export function buildExecutionHandoff(intelligence: TenderIntelligence): TenderIntelligenceExecutionHandoff {
  const lowConfidence = intelligence.extractedLineItems.filter((item) => item.reviewStatus === "REVIEW_REQUIRED").length;
  const pricingPages = intelligence.pricingTables.map((table) => table.sourcePage).sort((a, b) => a - b);
  const firstPage = pricingPages[0];
  const lastPage = pricingPages[pricingPages.length - 1];
  const blockers: string[] = [];
  if (intelligence.reviewStatus !== "APPROVED") blockers.push("Tender intelligence must be staff approved before pricing handoff");
  if (lowConfidence > 0) blockers.push(`${lowConfidence} low-confidence line item${lowConfidence === 1 ? "" : "s"} require review`);
  if (intelligence.boqClassification === "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND") blockers.push("Pricing is required but no usable template was found");

  const nextAction: TenderIntelligenceExecutionHandoff["nextAction"] =
    lowConfidence > 0
      ? "Resolve low-confidence line items"
      : intelligence.boqClassification === "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND"
        ? "Upload missing pricing template"
        : intelligence.pricingTables.length > 0 && intelligence.reviewStatus !== "APPROVED"
          ? "Confirm embedded BOQ on pages X-Y"
          : intelligence.reviewStatus !== "APPROVED"
            ? "Approve tender intelligence"
            : "Continue to supplier quote mapping";

  return {
    tenderAnalysisStatus: intelligence.analysisStatus,
    requirementsReviewStatus: intelligence.reviewStatus,
    boqDetectionStatus:
      intelligence.reviewStatus === "APPROVED" && intelligence.pricingTables.length > 0
        ? "APPROVED"
        : intelligence.pricingTables.length > 0
          ? "REVIEW_REQUIRED"
          : intelligence.boqClassification === "NO_PRICING_REQUIRED"
            ? "NOT_DETECTED"
            : "NOT_STARTED",
    pricingScheduleStatus:
      intelligence.reviewStatus === "APPROVED" && intelligence.extractedLineItems.length > 0
        ? "APPROVED"
        : intelligence.extractedLineItems.length > 0
          ? "REVIEW_REQUIRED"
          : intelligence.boqClassification === "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND"
            ? "MISSING"
            : intelligence.boqClassification === "NO_PRICING_REQUIRED"
              ? "NOT_APPLICABLE"
              : "DETECTED",
    pricingClassification: intelligence.boqClassification,
    extractedLineItemCount: intelligence.extractedLineItems.length,
    intelligenceConfidence: intelligence.analysisConfidence,
    analysisBlockers: blockers,
    nextAction:
      nextAction === "Confirm embedded BOQ on pages X-Y" && firstPage
        ? (`Confirm embedded BOQ on pages ${firstPage}-${lastPage}` as TenderIntelligenceExecutionHandoff["nextAction"])
        : nextAction,
    tenderIntelligenceId: intelligence.id,
  };
}

