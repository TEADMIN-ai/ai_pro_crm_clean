import type { Deal } from "@/types/deal";

export type TenderReadinessResult = {
  isReady: boolean;
  completionPercent: number;
  missingDocuments: string[];
  missingFields: string[];
};

export function computeTenderReadiness(deal: Deal): TenderReadinessResult {
  const missingDocuments: string[] = [];
  const missingFields: string[] = [];

  // --- Required documents ---
  const requiredDocs = ["company-registration", "tax-clearance"];

  const uploadedDocs =
    deal.documents?.map((d) => d.name.toLowerCase()) ?? [];

  for (const req of requiredDocs) {
    if (!uploadedDocs.some((d) => d.includes(req))) {
      missingDocuments.push(req);
    }
  }

  // --- Required fields ---
  if (!deal.clientName) missingFields.push("Client name");
  if (!deal.value || deal.value <= 0) missingFields.push("Deal value");

  const totalRequirements =
    requiredDocs.length + 2; // 2 required fields
  const completed =
    totalRequirements -
    (missingDocuments.length + missingFields.length);

  const completionPercent = Math.round(
    (completed / totalRequirements) * 100
  );

  return {
    isReady: missingDocuments.length === 0 && missingFields.length === 0,
    completionPercent,
    missingDocuments,
    missingFields,
  };
}