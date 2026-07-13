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
  title: "",
  reference: "",
  readiness: 0,
  status: "Under review",
  submissionProfile: "",
  requiredDocuments: [],
  missingDocuments: [],
  validation: [],
  signatures: [],
  boq: [],
  pricing: {
    subtotal: "R 0",
    contingency: "R 0",
    vat: "R 0",
    total: "R 0",
  },
  approvalTimeline: [],
  approvers: [],
};
