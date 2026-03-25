import type {
  PriceProvider,
  PriceProviderContext,
  PriceProviderQuote,
} from "@/lib/pricing/providers/priceProvider.interface";
import { createPriceService } from "@/lib/pricing/services/price.service";
import { calculateRecommendedPrice } from "@/lib/pricing/services/pricingStrategy";
import type { TenderData } from "@/types/tender.types";

function createTenderData(overrides: Partial<TenderData> = {}): TenderData {
  return {
    schemaVersion: "2026-01",
    schemaFamily: "TenderData",
    tenderId: "tender-1",
    title: "Road Upgrade Tender",
    sourceYear: 2026,
    status: "draft",
    timeline: {
      updatedAt: "2026-03-25T10:00:00.000Z",
    },
    requirements: [],
    documents: [],
    ...overrides,
  };
}

class SelectiveProvider implements PriceProvider {
  constructor(
    public readonly id: string,
    private readonly matcher: (context: PriceProviderContext) => boolean,
    private readonly quote: PriceProviderQuote
  ) {}

  canHandle(context: PriceProviderContext): boolean {
    return this.matcher(context);
  }

  async getQuote(): Promise<PriceProviderQuote> {
    return this.quote;
  }
}

describe("PriceService", () => {
  test("selects providers dynamically based on tender context", async () => {
    const targetProvider = new SelectiveProvider(
      "target-provider",
      (context) => context.tenderData.title.includes("Road"),
      {
        providerId: "target-provider",
        providerLabel: "Target Provider",
        basePrice: {
          amount: 1000000,
          currency: "ZAR",
        },
        estimatedValue: {
          amount: 1000000,
          currency: "ZAR",
        },
      }
    );
    const skippedProvider = new SelectiveProvider(
      "skipped-provider",
      () => false,
      {
        providerId: "skipped-provider",
        providerLabel: "Skipped Provider",
        basePrice: {
          amount: 900000,
          currency: "ZAR",
        },
        estimatedValue: {
          amount: 900000,
          currency: "ZAR",
        },
      }
    );

    const service = createPriceService({
      providers: [targetProvider, skippedProvider],
    });

    const selectedProviders = service.selectProviders({
      tenderData: createTenderData(),
    });

    expect(selectedProviders.map((provider) => provider.id)).toEqual(["target-provider"]);
  });

  test("aggregates provider quotes into TenderData pricing", async () => {
    const providerA = new SelectiveProvider(
      "provider-a",
      () => true,
      {
        providerId: "provider-a",
        providerLabel: "Provider A",
        basePrice: {
          amount: 1000000,
          currency: "ZAR",
        },
        estimatedValue: {
          amount: 1000000,
          currency: "ZAR",
        },
        recommendedValue: {
          amount: 1100000,
          currency: "ZAR",
        },
        confidenceScore: 0.8,
      }
    );
    const providerB = new SelectiveProvider(
      "provider-b",
      () => true,
      {
        providerId: "provider-b",
        providerLabel: "Provider B",
        basePrice: {
          amount: 1200000,
          currency: "ZAR",
        },
        estimatedValue: {
          amount: 1200000,
          currency: "ZAR",
        },
        recommendedValue: {
          amount: 1300000,
          currency: "ZAR",
        },
        confidenceScore: 0.6,
      }
    );

    const service = createPriceService({
      providers: [providerA, providerB],
      strategy: "competitive",
    });

    const tenderData = await service.hydrateTenderDataPricing(
      createTenderData({
        pricing: {
          status: "draft",
          assignedTo: "pricing-user",
          approvedAt: null,
          value: null,
          estimatedValue: null,
          metadata: {},
        },
      })
    );

    expect(tenderData.pricing).toMatchObject({
      status: "draft",
      assignedTo: "pricing-user",
      value: {
        amount: 1246666,
        currency: "ZAR",
      },
      estimatedValue: {
        amount: 1100000,
        currency: "ZAR",
      },
      metadata: {
        priceIntelligence: {
          providerIds: ["provider-a", "provider-b"],
          quoteCount: 2,
          strategy: "competitive",
          margin: 0.1,
          confidenceScore: 0.7,
        },
      },
    });
  });

  test("pricing strategies produce different recommendation outputs", () => {
    const snapshot = {
      basePrice: {
        amount: 1000000,
        currency: "ZAR",
      },
      marketPrice: {
        amount: 900000,
        currency: "ZAR",
      },
      confidenceScore: 0.75,
    };

    const conservative = calculateRecommendedPrice(snapshot, "conservative");
    const competitive = calculateRecommendedPrice(snapshot, "competitive");
    const aggressive = calculateRecommendedPrice(snapshot, "aggressive");

    expect(conservative.recommendedPrice?.amount).toBeGreaterThan(competitive.recommendedPrice?.amount ?? 0);
    expect(competitive.recommendedPrice?.amount).toBeGreaterThan(aggressive.recommendedPrice?.amount ?? 0);
    expect(conservative.margin).toBe(0.18);
    expect(competitive.margin).toBe(0.1);
    expect(aggressive.margin).toBe(0.04);
  });

  test("uses deterministic fallback when provider quotes are unavailable", async () => {
    const service = createPriceService({
      providers: [],
      strategy: "aggressive",
    });

    const tenderData = await service.hydrateTenderDataPricing(
      createTenderData({
        pricing: {
          status: "draft",
          assignedTo: null,
          approvedAt: null,
          value: {
            amount: 950000,
            currency: "ZAR",
          },
          estimatedValue: {
            amount: 900000,
            currency: "ZAR",
          },
          metadata: {},
        },
      })
    );

    expect(tenderData.pricing).toMatchObject({
      status: "draft",
      value: {
        amount: 936000,
        currency: "ZAR",
      },
      estimatedValue: {
        amount: 900000,
        currency: "ZAR",
      },
      metadata: {
        priceIntelligence: {
          quoteCount: 0,
          strategy: "aggressive",
          basePrice: {
            amount: 900000,
            currency: "ZAR",
          },
          recommendedPrice: {
            amount: 936000,
            currency: "ZAR",
          },
          margin: 0.04,
        },
      },
    });
  });
});
