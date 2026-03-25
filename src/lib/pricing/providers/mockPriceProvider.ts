import type { PriceProvider, PriceProviderContext, PriceProviderQuote } from "./priceProvider.interface";

function resolveCurrency(context: PriceProviderContext): string {
  return (
    context.tenderData.value?.currency ??
    context.tenderData.estimatedValue?.currency ??
    context.tenderData.pricing?.value?.currency ??
    context.tenderData.pricing?.estimatedValue?.currency ??
    "ZAR"
  );
}

function resolveBaseAmount(context: PriceProviderContext): number {
  return (
    context.tenderData.estimatedValue?.amount ??
    context.tenderData.value?.amount ??
    context.tenderData.pricing?.estimatedValue?.amount ??
    context.tenderData.pricing?.value?.amount ??
    100000
  );
}

export class MockPriceProvider implements PriceProvider {
  readonly id = "mock-static";

  canHandle(): boolean {
    return true;
  }

  async getQuote(context: PriceProviderContext): Promise<PriceProviderQuote> {
    const currency = resolveCurrency(context);
    const baseAmount = resolveBaseAmount(context);
    const recommendedAmount = Math.round(baseAmount * 1.08);

    return {
      providerId: this.id,
      providerLabel: "Mock Static Provider",
      basePrice: {
        amount: baseAmount,
        currency,
      },
      estimatedValue: {
        amount: baseAmount,
        currency,
      },
      recommendedValue: {
        amount: recommendedAmount,
        currency,
      },
      confidenceScore: 0.55,
      metadata: {
        strategy: "static-baseline",
      },
    };
  }
}
