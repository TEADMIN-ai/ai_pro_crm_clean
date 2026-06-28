export const API_ROUTES = {
  ME: "/api/me",
  AUTH_BOOTSTRAP: "/api/auth/bootstrap",
  AUTH_LOGIN: "/api/auth/login",
  AUTH_LOGOUT: "/api/auth/logout",
  AUTH_DEBUG: "/api/auth/debug",
  USERS: "/api/users",
  USERS_CREATE: "/api/users/create",
  USER_DETAIL: (uid: string) => `/api/users/${encodeURIComponent(uid)}`,
  CONTRACTORS: "/api/contractors",
  CONTRACTOR_DETAIL: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}`,
  CONTRACTOR: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}`,
  CONTRACTOR_DOCUMENTS: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}/documents`,
  CONTRACTOR_APPROVE: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}/approve`,
  CONTRACTOR_ONBOARDING: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}/onboarding`,
  CONTRACTOR_ACKNOWLEDGEMENTS: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}/acknowledgements`,
  CONTRACTOR_NOTES: (contractorId: string) =>
    `/api/contractors/${encodeURIComponent(contractorId)}/notes`,
  CONTRACTOR_DOCUMENT_REVIEW: (contractorId: string, documentType: string) =>
    `/api/contractor-documents/${encodeURIComponent(contractorId)}/${encodeURIComponent(documentType)}/review`,
  CONTRACTOR_DOCUMENT_EXECUTE: (contractorId: string, documentType: string) =>
    `/api/contractor-documents/${encodeURIComponent(contractorId)}/${encodeURIComponent(documentType)}/execute`,
  CONTRACTOR_DOCUMENTS_REPROCESS_FAILED: "/api/contractor-documents/reprocess-failed",
  DEALS: "/api/deals",
  DEAL_DETAIL: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}`,
  DEAL_ANALYZE: (id: string) => `/api/deals/${encodeURIComponent(id)}/analyze`,
  DEAL_TEMPLATES: (dealId: string) =>
    `/api/deals/${encodeURIComponent(dealId)}/templates`,
  DEAL_DOCUMENTS: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/documents`,
  DEAL_ACTIVITY: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/activity`,
  DEAL_ANALYTICS: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/analytics`,
  DEAL_ASSIGNMENT: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/assignment`,
  DEAL_NOTES: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/notes`,
  DEAL_STAGE: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/stage`,
  DEAL_PRICING_APPROVE: (dealId: string) =>
    `/api/deals/${encodeURIComponent(dealId)}/pricing/approve`,
  DEAL_SUBMIT: "/api/deals/submit",
  DEALS_INTELLIGENCE: "/api/deals/intelligence",
  DASHBOARD_ANALYTICS: "/api/deals/analytics",
  DASHBOARD_SUMMARY: "/api/dashboard/summary",
  HYGIENE: "/api/hygiene",
  HYGIENE_EVIDENCE: "/api/hygiene/evidence",
  HYGIENE_JOBS: "/api/hygiene/jobs",
  HYGIENE_MANIFESTS: "/api/hygiene/manifests",
  HYGIENE_ASSETS: "/api/hygiene/assets",
  HYGIENE_COMPLIANCE: "/api/hygiene/compliance",
  HYGIENE_REPORTS: "/api/hygiene/reports",
  VEHICLE_FINANCE_OVERVIEW: "/api/vehicle-finance/overview",
  VEHICLE_FINANCE_CUSTOMERS: "/api/vehicle-finance/customers",
  VEHICLE_FINANCE_APPLICATIONS: "/api/vehicle-finance/applications",
  VEHICLE_FINANCE_REPORTS: "/api/vehicle-finance/reports",
  VEHICLE_FINANCE_ROAR_INVENTORY: "/api/vehicle-finance/roar-inventory",
  VEHICLE_FINANCE_INVENTORY_SYNC: "/api/vehicle-finance/inventory-sync",
  VEHICLE_FINANCE_TRAINING_OVERVIEW: "/api/vehicle-finance/training/overview",
  QS_BOQ_UPLOAD: "/api/qs/boq/upload",
  QS_BOQ_REVIEW: "/api/qs/boq/review",
  QS_ESTIMATES: "/api/qs/estimates",
  QS_ESTIMATE_DETAIL: (estimateId: string) => `/api/qs/estimates/${encodeURIComponent(estimateId)}`,
  QS_SUPPLIERS: "/api/qs/suppliers",
  QS_SUPPLIER_DETAIL: (supplierId: string) => `/api/qs/suppliers/${encodeURIComponent(supplierId)}`,
  QS_SUPPLIER_OFFERS: "/api/qs/supplier-offers",
  QS_SUPPLIER_RECOMMENDATIONS: (estimateId: string) =>
    `/api/qs/estimates/${encodeURIComponent(estimateId)}/supplier-recommendations`,
  QS_COMMERCIAL_IMPACT: (estimateId: string) =>
    `/api/qs/estimates/${encodeURIComponent(estimateId)}/commercial-impact`,
  QS_SUPPLIER_CONTACT_ACTIONS: "/api/qs/supplier-contact-actions",
  QS_COMMERCIAL_INTELLIGENCE_SUMMARY: "/api/qs/commercial-intelligence/summary",
  QS_COMMERCIAL_FEEDBACK: "/api/qs/commercial-feedback",
  QS_SUPPLIER_PERFORMANCE_RATINGS: "/api/qs/supplier-performance-ratings",
  QS_MATERIAL_PRICE_OBSERVATIONS: "/api/qs/material-price-observations",
  QS_REGIONAL_SUPPLIER_INTELLIGENCE: "/api/qs/regional-supplier-intelligence",
  QS_SUPPLIER_DECISION_FLAGS: "/api/qs/supplier-decision-flags",
  DOCUMENTS: "/api/documents",
  DOCUMENT_DETAIL: (documentId: string) =>
    `/api/documents/${encodeURIComponent(documentId)}`,
  DOCUMENT_EXECUTE: (id: string) => `/api/documents/${encodeURIComponent(id)}/execute`,
  DOCUMENT_STATUS: (documentId: string) =>
    `/api/documents/${encodeURIComponent(documentId)}/status`,
  GOVERNANCE_ALERT_WORKFLOW: (alertId: string) =>
    `/api/governance/alerts/${encodeURIComponent(alertId)}/workflow`,
  DOCUMENT_UPLOAD: "/api/documents/upload",
  DOCUMENT_UPLOAD_ANALYZE: "/api/documents/upload-analyze",
  TENDER_PACK: (dealId: string) => `/api/tender-pack?dealId=${encodeURIComponent(dealId)}`,
  TENDER_PACK_PREVIEW: (dealId: string) =>
    `/api/tender-pack/preview?dealId=${encodeURIComponent(dealId)}`,
  TENDER_PACK_PREVIEW_PDF: (dealId: string) =>
    `/api/tender-pack/preview-pdf?dealId=${encodeURIComponent(dealId)}`,
  TENDER_PACK_GENERATE: "/api/tender-pack/generate",
  TENDER_PACK_REQUESTS: "/api/tender-pack/requests",
  TENDER_PACK_REQUEST_DETAIL: (requestId: string) =>
    `/api/tender-pack/requests/${encodeURIComponent(requestId)}`,
  TENDER_PACK_VALIDATE: "/api/tender-pack/validate",
  TENDER_PACK_TEST_FILL: "/api/tender-pack/test-fill",
  TENDER_ANALYZE: "/api/tenders/analyze",
  TENDER_PREVIEW: "/api/tender/preview",
  TENDER_GENERATE: "/api/tender/generate",
  TENDER_EMAIL: "/api/tender/email",
  SBD4_GENERATE: "/api/sbd4/generate",
  RISKS: "/api/risks",
  RISK_DETAIL: (riskId: string) => `/api/risks/${encodeURIComponent(riskId)}`,
  AUDIT_LOGS: "/api/audit-logs",
  AUDIT_PROJECTS: "/api/audits/projects",
  AUDIT_PROJECT_DETAIL: (projectId: string) =>
    `/api/audits/projects/${encodeURIComponent(projectId)}`,
  AUDIT_PROJECT_TASKS: (projectId: string) =>
    `/api/audits/projects/${encodeURIComponent(projectId)}/tasks`,
  AUDIT_PROJECT_TASK_DETAIL: (projectId: string, taskId: string) =>
    `/api/audits/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
  AUDIT_PROJECT_FINDINGS: (projectId: string) =>
    `/api/audits/projects/${encodeURIComponent(projectId)}/findings`,
  AUDIT_PROJECT_FINDING_DETAIL: (projectId: string, findingId: string) =>
    `/api/audits/projects/${encodeURIComponent(projectId)}/findings/${encodeURIComponent(findingId)}`,
  LEADS: "/api/leads",
  PORTAL_REGISTER: "/api/portal/register",
  SYNC_ROLE: "/api/sync-role",
  AI_TENDER_SUMMARY: (tenderId: string) =>
    `/api/ai/tender-summary?tenderId=${encodeURIComponent(tenderId)}`,
  MANUS_WORKFLOW: "/api/manus/workflow",
  MANUS_TENDER: "/api/manus/tender",
  MANUS_STATUS: (workflowId: string) => `/api/manus/status?workflowId=${encodeURIComponent(workflowId)}`,
  SMOKE_CONTRACTOR_DOCS: "/api/contractors/smoke-check/documents",
  SMOKE_DOCUMENT_EXECUTE: "/api/documents/smoke-check/execute",
} as const;

export type ApiRouteKey = keyof typeof API_ROUTES;
