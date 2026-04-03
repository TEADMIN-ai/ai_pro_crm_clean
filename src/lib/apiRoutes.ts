// src/lib/apiRoutes.ts

export const API_ROUTES = {
  ME: "/api/me",
  DEALS: "/api/deals",
  CONTRACTORS: "/api/contractors",
  DOCUMENTS: "/api/documents",
  DOCUMENT_EXECUTE: (id: string) => `/api/documents/${id}/execute`,
  CONTRACTOR_DOCUMENTS: (contractorId: string) =>
    `/api/contractors/${contractorId}/documents`,
};