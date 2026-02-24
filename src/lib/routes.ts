export const API_ROUTES = {
  CONTRACTORS: "/api/contractors",
  CONTRACTOR_DOCUMENTS: (contractorId: string) =>
    `/api/contractors/${contractorId}/documents`,
  DEALS: "/api/deals",
};
