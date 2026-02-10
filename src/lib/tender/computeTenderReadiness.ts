import type { Deal } from "@/types/deal";

export type TenderReadinessResult = {
  isReady: boolean;
  completionPercent: number;
  missingDocuments: string[];
  missingFields: string[];
};

export function computeTenderReadiness(deal: any) {
  const missingDocuments: string[] = [];
  const missingFields: string[] = [];

  // must be manager approved
  if (deal.pricingStatus !== "manager_approved") {
    missingFields.push("pricingStatus");
  }

  // must be assigned
  if (!deal.assignedTo) {
    missingFields.push("assignedTo");
  }

  // must be in correct stage
  if (deal.stage !== "manager_review") {
    missingFields.push("stage");
  }

  const isReady = missingFields.length === 0;

  return {
    isReady,
    completionPercent: isReady ? 100 : Math.max(0, 100 - missingFields.length * 20),
    missingDocuments, // you can add document logic later
    missingFields,
  };
}