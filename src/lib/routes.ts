export const API_ROUTES = {
  CONTRACTORS: "/api/contractors",
  CONTRACTOR_DOCUMENTS: (contractorId: string) =>
    `/api/contractors/${contractorId}/documents`,
  DOCUMENT_EXECUTE: (documentId: string) =>
    `/api/documents/${documentId}/execute`,
  TENDER_PACK_GENERATE: "/api/tender-pack/generate",
  DEALS: "/api/deals",
  PORTAL_REGISTER: "/api/portal/register",
  SYNC_ROLE: "/api/sync-role",
  AI_TENDER_SUMMARY: (tenderId: string) =>
    `/api/ai/tender-summary?tenderId=${encodeURIComponent(tenderId)}`,
};
