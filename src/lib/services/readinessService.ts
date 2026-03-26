import { getLatestDocumentsByType } from "@/lib/compliance/contractorCompliance";

export function calculateReadiness(documents: any[]) {
  const latestDocuments = getLatestDocumentsByType(documents);
  const total = latestDocuments.length;

  if (total === 0) {
    return 0;
  }

  const validDocs = latestDocuments.filter(
    (doc) => (doc?.status === "APPROVED" || (typeof doc?.status !== "string" && doc?.verified === true)) && doc?.isExpired !== true
  );

  const score = Math.round((validDocs.length / total) * 100);
  return score;
}
