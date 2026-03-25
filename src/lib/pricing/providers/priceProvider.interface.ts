import type { TenderData, TenderPricingSnapshot, TenderValueMoney } from "@/types/tender.types";

export interface PriceProviderContext {
  tenderData: TenderData;
}

export interface PriceProviderQuote {
  providerId: string;
  providerLabel: string;
  basePrice?: TenderValueMoney | null;
  estimatedValue?: TenderValueMoney | null;
  recommendedValue?: TenderValueMoney | null;
  confidenceScore?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PriceCache {
  get(key: string): Promise<TenderPricingSnapshot | null>;
  set(key: string, value: TenderPricingSnapshot, ttlSeconds: number): Promise<void>;
}

export interface PriceProvider {
  readonly id: string;
  canHandle(context: PriceProviderContext): boolean;
  getQuote(context: PriceProviderContext): Promise<PriceProviderQuote | null>;
}
