import { calculatePortfolioIntelligence } from "@/lib/intelligence/portfolioIntelligenceEngine";
import type { Deal } from "@/types/deal";
import { listDealsForUser } from "@/server/services/dealService";
import type { AuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export interface DashboardTenderInsights {
  avgReadinessScore: number;
  totalEstimatedDealValue: number;
  missingComplianceItems: string[];
  highRiskDeals: number;
}

export interface DashboardAnalyticsPayload {
  deals: Deal[];
  contractorCount: number;
  executiveSummary: string;
  portfolio: ReturnType<typeof calculatePortfolioIntelligence>;
  tenderInsights: DashboardTenderInsights;
}

function buildTenderInsights(deals: Deal[]): DashboardTenderInsights {
  if (deals.length === 0) {
    return {
      avgReadinessScore: 0,
      totalEstimatedDealValue: 0,
      missingComplianceItems: [],
      highRiskDeals: 0,
    };
  }

  const totalReadiness = deals.reduce((sum, deal) => sum + (typeof deal.readinessScore === "number" ? deal.readinessScore : 0), 0);
  const totalEstimatedDealValue = deals.reduce(
    (sum, deal) => sum + (typeof deal.estimatedDealValue === "number" ? deal.estimatedDealValue : 0),
    0
  );
  const missingComplianceItems = Array.from(
    new Set(deals.flatMap((deal) => (Array.isArray(deal.missingRequirements) ? deal.missingRequirements : [])))
  );
  const highRiskDeals = deals.filter((deal) => deal.riskLevel === "HIGH" || deal.riskLevel === "CRITICAL").length;

  return {
    avgReadinessScore: Math.round(totalReadiness / deals.length),
    totalEstimatedDealValue,
    missingComplianceItems,
    highRiskDeals,
  };
}

export async function getDashboardAnalytics(user: AuthorizedUser): Promise<DashboardAnalyticsPayload> {
  const [deals, contractorsSnapshot] = await Promise.all([
    listDealsForUser(user),
    getFirebaseAdmin().collection("contractors").get(),
  ]);

  return {
    deals,
    contractorCount: contractorsSnapshot.size,
    executiveSummary:
      deals.length > 0
        ? "Operational portfolio metrics are available and current."
        : "No deal activity is available yet.",
    portfolio: calculatePortfolioIntelligence(deals),
    tenderInsights: buildTenderInsights(deals),
  };
}
