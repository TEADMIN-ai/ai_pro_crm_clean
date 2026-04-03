export const API_ROUTES = {
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
  TENDER_PACK: (dealId: string) => `/api/tender-pack?dealId=${encodeURIComponent(dealId)}`,
  TENDER_PACK_PREVIEW: (dealId: string) => `/api/tender-pack/preview?dealId=${encodeURIComponent(dealId)}`,
  TENDER_PACK_PREVIEW_PDF: (dealId: string) =>
    `/api/tender-pack/preview-pdf?dealId=${encodeURIComponent(dealId)}`,
  TENDER_PACK_VALIDATE: "/api/tender-pack/validate",
  CONTRACTOR_DOCUMENT_REVIEW: (contractorId: string, documentType: string) =>
    `/api/contractor-documents/${encodeURIComponent(contractorId)}/${encodeURIComponent(documentType)}/review`,
  DOCUMENTS: "/api/documents",
  DOCUMENT_DETAIL: (documentId: string) =>
    `/api/documents/${encodeURIComponent(documentId)}`,
  DOCUMENT_EXECUTE: (documentId: string) =>
    `/api/documents/${documentId}/execute`,
  DOCUMENT_STATUS: (documentId: string) =>
    `/api/documents/${encodeURIComponent(documentId)}/status`,
  DOCUMENT_UPLOAD: "/api/documents/upload",
  TENDER_PACK_GENERATE: "/api/tender-pack/generate",
  SBD4_GENERATE: "/api/sbd4/generate",
  DEALS: "/api/deals",
  DEAL_DETAIL: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}`,
  DEAL_TEMPLATES: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/templates`,
  RISKS: "/api/risks",
  RISK_DETAIL: (riskId: string) => `/api/risks/${encodeURIComponent(riskId)}`,
  AUDIT_LOGS: "/api/audit-logs",
  AUDIT_PROJECTS: "/api/audits/projects",
  AUDIT_PROJECT_DETAIL: (projectId: string) => `/api/audits/projects/${encodeURIComponent(projectId)}`,
  AUDIT_PROJECT_TASKS: (projectId: string) => `/api/audits/projects/${encodeURIComponent(projectId)}/tasks`,
  AUDIT_PROJECT_TASK_DETAIL: (projectId: string, taskId: string) =>
    `/api/audits/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
  AUDIT_PROJECT_FINDINGS: (projectId: string) => `/api/audits/projects/${encodeURIComponent(projectId)}/findings`,
  AUDIT_PROJECT_FINDING_DETAIL: (projectId: string, findingId: string) =>
    `/api/audits/projects/${encodeURIComponent(projectId)}/findings/${encodeURIComponent(findingId)}`,
  DEAL_DOCUMENTS: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/documents`,
  DEAL_ACTIVITY: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/activity`,
  DEAL_ANALYTICS: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/analytics`,
  DEAL_ASSIGNMENT: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/assignment`,
  DEAL_STAGE: (dealId: string) => `/api/deals/${encodeURIComponent(dealId)}/stage`,
  DEAL_PRICING_APPROVE: (dealId: string) =>
    `/api/deals/${encodeURIComponent(dealId)}/pricing/approve`,
  DASHBOARD_ANALYTICS: "/api/deals/analytics",
  DEAL_SUBMIT: "/api/deals/submit",
  LEADS: "/api/leads",
  PORTAL_REGISTER: "/api/portal/register",
  SYNC_ROLE: "/api/sync-role",
  AI_TENDER_SUMMARY: (tenderId: string) =>
    `/api/ai/tender-summary?tenderId=${encodeURIComponent(tenderId)}`,
};
