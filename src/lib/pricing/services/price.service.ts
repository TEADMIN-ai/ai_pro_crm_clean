import type { TenderData, TenderPricingSnapshot, TenderValueMoney } from "@/types/tender.types";
import type {
  PriceCache,
  PriceProvider,
  PriceProviderContext,
  PriceProviderQuote,
} from "@/lib/pricing/providers/priceProvider.interface";
import { MockPriceProvider } from "@/lib/pricing/providers/mockPriceProvider";
import {
  calculateRecommendedPrice,
  type PricingStrategy,
} from "@/lib/pricing/services/pricingStrategy";

type PriceServiceOptions = {
  providers?: PriceProvider[];
  cache?: PriceCache;
  cacheTtlSeconds?: number;
  strategy?: PricingStrategy;
};

function averageMoney(values: TenderValueMoney[]): TenderValueMoney | null {
  if (values.length === 0) {
    return null;
  }

  const currency = values[0]?.currency;
  if (!currency || values.some((value) => value.currency !== currency)) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value.amount, 0);
  return {
    amount: Math.round(total / values.length),
    currency,
  };
}

function buildCacheKey(context: PriceProviderContext): string {
  const updatedAt = context.tenderData.timeline.updatedAt ?? context.tenderData.timeline.createdAt ?? "na";
  return `pricing:${context.tenderData.tenderId}:${updatedAt}`;
}

function averageNumber(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function resolveFallbackBasePrice(existingPricing: TenderPricingSnapshot | null | undefined): TenderValueMoney | null {
  return existingPricing?.estimatedValue ?? existingPricing?.value ?? null;
}

function toJsonMoney(value: TenderValueMoney | null): { amount: number; currency: string } | null {
  if (!value) {
    return null;
  }

  return {
    amount: value.amount,
    currency: value.currency,
  };
}

function aggregateQuotes(
  existingPricing: TenderPricingSnapshot | null | undefined,
  quotes: PriceProviderQuote[],
  strategy: PricingStrategy
): TenderPricingSnapshot | null {
  const fallbackBasePrice = resolveFallbackBasePrice(existingPricing);
  const basePrices = quotes
    .map((quote) => quote.basePrice ?? quote.estimatedValue)
    .filter((value): value is TenderValueMoney => Boolean(value));
  const estimatedValues = quotes
    .map((quote) => quote.estimatedValue)
    .filter((value): value is TenderValueMoney => Boolean(value));
  const marketRecommendedValues = quotes
    .map((quote) => quote.recommendedValue)
    .filter((value): value is TenderValueMoney => Boolean(value));
  const confidenceScores = quotes
    .map((quote) => quote.confidenceScore)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const basePrice = averageMoney(basePrices) ?? fallbackBasePrice;
  const marketPrice = averageMoney(marketRecommendedValues);
  const confidenceScore = averageNumber(confidenceScores);
  const decision = calculateRecommendedPrice(
    {
      basePrice,
      marketPrice,
      confidenceScore,
    },
    strategy
  );

  if (!decision.basePrice && !existingPricing) {
    return null;
  }

  return {
    status: existingPricing?.status ?? "price_intelligence_ready",
    assignedTo: existingPricing?.assignedTo ?? null,
    approvedAt: existingPricing?.approvedAt ?? null,
    value: decision.recommendedPrice ?? existingPricing?.value ?? null,
    estimatedValue: decision.basePrice ?? averageMoney(estimatedValues) ?? existingPricing?.estimatedValue ?? null,
    metadata: {
      ...(existingPricing?.metadata ?? {}),
      priceIntelligence: {
        providerIds: quotes.map((quote) => quote.providerId),
        providers: quotes.map((quote) => ({
          id: quote.providerId,
          label: quote.providerLabel,
          confidenceScore: quote.confidenceScore ?? null,
          metadata: quote.metadata ?? {},
        })),
        quoteCount: quotes.length,
        strategy: decision.strategy,
        basePrice: toJsonMoney(decision.basePrice),
        recommendedPrice: toJsonMoney(decision.recommendedPrice),
        margin: decision.margin,
        confidenceScore: decision.confidenceScore,
      },
    },
  };
}

export class PriceService {
  private readonly providers: PriceProvider[];
  private readonly cache?: PriceCache;
  private readonly cacheTtlSeconds: number;
  private readonly strategy: PricingStrategy;

  constructor(options: PriceServiceOptions = {}) {
    this.providers = options.providers ?? [new MockPriceProvider()];
    this.cache = options.cache;
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? 300;
    this.strategy = options.strategy ?? "competitive";
  }

  getProviderIds(): string[] {
    return this.providers.map((provider) => provider.id);
  }

  selectProviders(context: PriceProviderContext): PriceProvider[] {
    return this.providers.filter((provider) => provider.canHandle(context));
  }

  async resolvePricing(context: PriceProviderContext): Promise<TenderPricingSnapshot | null> {
    const cacheKey = buildCacheKey(context);

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const quotes = await Promise.all(
      this.selectProviders(context).map((provider) => provider.getQuote(context))
    );
    const resolvedPricing = aggregateQuotes(
      context.tenderData.pricing,
      quotes.filter((quote): quote is PriceProviderQuote => quote !== null),
      this.strategy
    );

    if (resolvedPricing && this.cache) {
      await this.cache.set(cacheKey, resolvedPricing, this.cacheTtlSeconds);
    }

    return resolvedPricing;
  }

  async hydrateTenderDataPricing(tenderData: TenderData): Promise<TenderData> {
    const pricing = await this.resolvePricing({ tenderData });

    if (!pricing) {
      return tenderData;
    }

    return {
      ...tenderData,
      pricing,
    };
  }
}

const defaultPriceService = new PriceService();

export async function hydrateTenderDataPricing(tenderData: TenderData): Promise<TenderData> {
  return defaultPriceService.hydrateTenderDataPricing(tenderData);
}

export function createPriceService(options?: PriceServiceOptions): PriceService {
  return new PriceService(options);
}
