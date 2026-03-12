export const API_ROUTES = {
  AUTH_LOGIN: "/api/auth/login",
  AUTH_LOGOUT: "/api/auth/logout",
  AUTH_DEBUG: "/api/auth/debug",
  CONTRACTORS: "/api/contractors",
  CONTRACTOR_DETAIL: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}`,
  CONTRACTOR: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}`,
  CONTRACTOR_DOCUMENTS: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}/documents`,
  DOCUMENT_EXECUTE: (documentId: string) =>
    `/api/documents/${documentId}/execute`,
  TENDER_PACK_GENERATE: "/api/tender-pack/generate",
  DEALS: "/api/deals",
  DEAL_SUBMIT: "/api/deals/submit",
  PORTAL_REGISTER: "/api/portal/register",
  SYNC_ROLE: "/api/sync-role",
  AI_TENDER_SUMMARY: (tenderId: string) =>
    `/api/ai/tender-summary?tenderId=${encodeURIComponent(tenderId)}`,
};
