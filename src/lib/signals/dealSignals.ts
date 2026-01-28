import type { Deal } from "@/types/deal";

export function computeDealSignals(deal: Deal) {
  const requiredDocuments: string[] = [
    "id",
    "contract",
    "purchase_order",
  ];

  const uploadedDocs = deal.documents ?? [];

  const uploadedDocIds = uploadedDocs.map(doc => doc.id);

  const missingDocuments = requiredDocuments.filter(
    reqId => !uploadedDocIds.includes(reqId)
  );

  return {
    missingDocuments,
    hasAllDocuments: missingDocuments.length === 0,
  };
}