export type SubmissionReviewDocument = {
  key: string;
  label: string;
  category: string;
  status: "ready" | "missing" | "pending";
  note?: string;
};

export type SubmissionReviewValidation = {
  key: string;
  label: string;
  detail: string;
  status: "pass" | "warn" | "fail";
};

export type SubmissionReviewSignature = {
  key: string;
  role: string;
  signer: string;
  status: "complete" | "waiting" | "queued";
  note?: string;
};

export type SubmissionReviewBoqLine = {
  key: string;
  item: string;
  quantity: string;
  unitRate: string;
  amount: string;
  status: "confirmed" | "pending";
};

export type SubmissionReviewApprover = {
  key: string;
  name: string;
  role: string;
  status: "approved" | "waiting" | "review";
  timestamp?: string;
};

export type SubmissionReviewState = {
  title: string;
  reference: string;
  readiness: number;
  status: "Ready for approval" | "Pending changes" | "Under review";
  submissionProfile: string;
  requiredDocuments: SubmissionReviewDocument[];
  missingDocuments: SubmissionReviewDocument[];
  validation: SubmissionReviewValidation[];
  signatures: SubmissionReviewSignature[];
  boq: SubmissionReviewBoqLine[];
  pricing: {
    subtotal: string;
    contingency: string;
    vat: string;
    total: string;
  };
  approvalTimeline: Array<{ key: string; stage: string; detail: string; timestamp: string; status: "done" | "active" | "pending" }>;
  approvers: SubmissionReviewApprover[];
};

export const submissionReviewState: SubmissionReviewState = {
  title: "Submission Review",
  reference: "SUB-2026-041",
  readiness: 84,
  status: "Under review",
  submissionProfile: "Government Submission Profile",
  requiredDocuments: [
    { key: "tax", label: "Tax Clearance Certificate", category: "Compliance", status: "ready" },
    { key: "cipc", label: "CIPC Registration", category: "Company Profile", status: "ready" },
    { key: "bank", label: "Bank Confirmation Letter", category: "Financial", status: "ready" },
    { key: "id", label: "Authorized Signatory ID", category: "Compliance", status: "pending" },
    { key: "sbd1", label: "SBD1 Invitation to Bid", category: "Forms", status: "ready" },
    { key: "sbd4", label: "SBD4 Declaration of Interest", category: "Forms", status: "missing", note: "Signature still required." },
  ],
  missingDocuments: [
    { key: "sbd4", label: "SBD4 Declaration of Interest", category: "Forms", status: "missing", note: "Pending signature capture." },
    { key: "witness", label: "Witness Sign-off", category: "Signatures", status: "missing", note: "Awaiting counter-signature." },
  ],
  validation: [
    { key: "v1", label: "Document order", detail: "Required documents are ordered to match submission sequence.", status: "pass" },
    { key: "v2", label: "Naming convention", detail: "File naming matches the profile convention.", status: "pass" },
    { key: "v3", label: "Missing signatures", detail: "One internal and one external signature remain open.", status: "warn" },
  ],
  signatures: [
    { key: "s1", role: "Authorized Signatory", signer: "A. Naidoo", status: "complete", note: "Captured digitally." },
    { key: "s2", role: "Witness", signer: "Open", status: "waiting", note: "Needed before final pack generation." },
    { key: "s3", role: "Compliance Reviewer", signer: "M. Jacobs", status: "queued", note: "Pending final review." },
  ],
  boq: [
    { key: "b1", item: "Preliminaries", quantity: "1", unitRate: "R 24,500", amount: "R 24,500", status: "confirmed" },
    { key: "b2", item: "Materials Allowance", quantity: "1", unitRate: "R 110,000", amount: "R 110,000", status: "confirmed" },
    { key: "b3", item: "Contingency", quantity: "1", unitRate: "R 18,000", amount: "R 18,000", status: "pending" },
  ],
  pricing: {
    subtotal: "R 134,500",
    contingency: "R 18,000",
    vat: "R 22,875",
    total: "R 175,375",
  },
  approvalTimeline: [
    { key: "t1", stage: "Draft prepared", detail: "Submission pack assembled from approved profile assets.", timestamp: "2026-07-12 08:40", status: "done" },
    { key: "t2", stage: "Internal validation", detail: "Checks completed against required document matrix.", timestamp: "2026-07-12 10:15", status: "done" },
    { key: "t3", stage: "Approval review", detail: "Awaiting final approver decision and signature completion.", timestamp: "2026-07-12 12:05", status: "active" },
    { key: "t4", stage: "Final pack release", detail: "Generation will be staged after approval.", timestamp: "Pending", status: "pending" },
  ],
  approvers: [
    { key: "a1", name: "Lerato M.", role: "Submission Owner", status: "approved", timestamp: "2026-07-12 10:18" },
    { key: "a2", name: "Aisha K.", role: "Commercial Reviewer", status: "review", timestamp: "2026-07-12 12:05" },
    { key: "a3", name: "Johan P.", role: "Executive Approver", status: "waiting" },
  ],
};
