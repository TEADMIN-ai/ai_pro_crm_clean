import type { TenderValueMoney } from "@/types/tender.types";

export type PricingStrategy = "conservative" | "competitive" | "aggressive";

export interface PricingDecisionSnapshot {
  basePrice: TenderValueMoney | null;
  marketPrice: TenderValueMoney | null;
  confidenceScore: number | null;
}

export interface PricingDecisionResult {
  basePrice: TenderValueMoney | null;
  recommendedPrice: TenderValueMoney | null;
  margin: number;
  confidenceScore: number | null;
  strategy: PricingStrategy;
}

const STRATEGY_MARGIN: Record<PricingStrategy, number> = {
  conservative: 0.18,
  competitive: 0.1,
  aggressive: 0.04,
};

function roundAmount(amount: number): number {
  return Math.round(amount);
}

export function calculateRecommendedPrice(
  snapshot: PricingDecisionSnapshot,
  strategy: PricingStrategy
): PricingDecisionResult {
  const margin = STRATEGY_MARGIN[strategy];
  const basePrice = snapshot.basePrice;

  if (!basePrice) {
    return {
      basePrice: null,
      recommendedPrice: null,
      margin,
      confidenceScore: snapshot.confidenceScore,
      strategy,
    };
  }

  const marketPrice = snapshot.marketPrice;
  const anchorAmount = marketPrice && marketPrice.currency === basePrice.currency
    ? roundAmount((basePrice.amount * 2 + marketPrice.amount) / 3)
    : basePrice.amount;

  return {
    basePrice,
    recommendedPrice: {
      amount: roundAmount(anchorAmount * (1 + margin)),
      currency: basePrice.currency,
    },
    margin,
    confidenceScore: snapshot.confidenceScore,
    strategy,
  };
}
