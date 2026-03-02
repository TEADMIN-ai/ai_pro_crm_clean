// src/lib/constants/routes.ts

/**
 * Central API route registry.
 * Single source of truth for all client → API calls.
 * Prevents hardcoded string drift across the app.
 */

export const API_ROUTES = {
  // Core entities
  CONTRACTORS: "/api/contractors",
  DEALS: "/api/deals",

  // Contractor documents
  CONTRACTOR_DOCUMENTS: (contractorId: string) =>
    `/api/contractors/${contractorId}/documents`,

  // Tender pack generation
  TENDER_PACK_GENERATE: "/api/tender-pack/generate",
  TENDER_PACK_TEST_FILL: "/api/tender-pack/test-fill",

  // Smoke checks (used in sanity tests)
  SMOKE_CONTRACTOR_DOCS: "/api/contractors/smoke-check/documents",
  SMOKE_DOCUMENT_EXECUTE: "/api/documents/smoke-check/execute",
} as const;

export type ApiRouteKey = keyof typeof API_ROUTES;