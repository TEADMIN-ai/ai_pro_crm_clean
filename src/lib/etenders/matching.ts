import type { EtendersSourceRecord } from "@/lib/etenders/types";
import type { ContractorMatchRecommendation } from "@/lib/opportunities/contractorMatchingPresentation";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function includesAny(text: string, values: string[]): boolean {
  const lower = text.toLowerCase();
  return values.some((value) => lower.includes(value.toLowerCase()));
}

function isMockContractor(contractor: Record<string, unknown>): boolean {
  return contractor.demoContractor === true ||
    contractor.benchmarkContractor === true ||
    contractor.regressionValidationContractor === true ||
    contractor.operationalReplayContractor === true ||
    contractor.canonicalProfile === true;
}

export function recommendContractorsForEtendersOpportunity(
  source: EtendersSourceRecord,
  contractors: Array<Record<string, unknown> & { id: string }>,
): ContractorMatchRecommendation[] {
  const sourceText = [source.category, source.title, source.description, source.province, ...source.cidbRequirements].filter(Boolean).join(" ");

  return contractors
    .filter((contractor) => !isMockContractor(contractor))
    .map((contractor) => {
      const capabilities = asStringArray(contractor.capabilities ?? contractor.serviceCategories ?? contractor.services);
      const regions = asStringArray(contractor.provinces ?? contractor.serviceAreas ?? contractor.regions);
      const cidb = asStringArray(contractor.cidbGradings ?? contractor.cidbRequirements);
      const capabilityMatch = capabilities.length === 0 ? 0 : includesAny(sourceText, capabilities) ? 35 : 0;
      const regionMatch = !source.province || regions.length === 0 ? 10 : regions.includes(source.province) ? 20 : 0;
      const cidbMatch = source.cidbRequirements.length === 0 ? 10 : source.cidbRequirements.some((item) => cidb.includes(item)) ? 20 : -15;
      const readinessScore = typeof contractor.readinessScore === "number" ? contractor.readinessScore : 0;
      const docsMissing = typeof contractor.docsMissing === "number" ? contractor.docsMissing : 0;
      const compliance = docsMissing > 0 ? "Blocked" : readinessScore >= 70 ? "Ready" : "Review Required";
      const score = Math.max(0, Math.min(100, capabilityMatch + regionMatch + cidbMatch + Math.round(readinessScore * 0.35)));
      return {
        contractorId: String(contractor.contractorId ?? contractor.id),
        contractorName: String(contractor.companyName ?? contractor.businessName ?? contractor.name ?? contractor.id),
        bucket: score >= 70 && compliance !== "Blocked" ? "recommended" : compliance === "Blocked" ? "pending-review" : "pending-review",
        readinessScore,
        compliance,
        experience: capabilities.join(", ") || "No capability metadata available",
        requiredCertifications: source.cidbRequirements,
        previousAwards: asStringArray(contractor.previousAwards),
        currentWorkload: String(contractor.currentWorkload ?? "Unknown"),
        winRate: typeof contractor.winRate === "number" ? contractor.winRate : 0,
        aiMatchScore: score,
        notes: docsMissing > 0 ? "Missing compliance documents block submission readiness." : "Matched against source category, geography, CIDB and readiness metadata.",
      } satisfies ContractorMatchRecommendation;
    })
    .sort((left, right) => right.aiMatchScore - left.aiMatchScore);
}

