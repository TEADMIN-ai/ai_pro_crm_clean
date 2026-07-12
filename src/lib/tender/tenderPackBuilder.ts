export type TenderPackDocument = {
  key: string;
  label: string;
  category: string;
  status: "required" | "generated" | "missing";
  note?: string;
};

export type TenderPackGeneratedPdf = {
  key: string;
  name: string;
  pages: number;
  size: string;
  status: "ready" | "preview" | "queued";
};

export type TenderPackSubmissionProfile = {
  key: string;
  label: string;
  audience: string;
  summary: string;
  packageType: string;
  compliance: string;
};

export type TenderPackBuilderState = {
  title: string;
  reference: string;
  progress: number;
  profile: TenderPackSubmissionProfile;
  requiredDocuments: TenderPackDocument[];
  generatedPdfs: TenderPackGeneratedPdf[];
  missingDocuments: TenderPackDocument[];
};

export const tenderPackBuilderState: TenderPackBuilderState = {
  title: "Tender Pack Builder",
  reference: "TE-TP-2026-041",
  progress: 72,
  profile: {
    key: "government",
    label: "Government Submission Profile",
    audience: "Public sector procurement",
    summary: "Submission pack structure with formal declarations, signed forms and audit-ready ordering.",
    packageType: "Government tender pack",
    compliance: "Ready for internal review",
  },
  requiredDocuments: [
    { key: "tax", label: "Tax Clearance Certificate", category: "Compliance", status: "generated" },
    { key: "cipc", label: "CIPC Registration", category: "Company profile", status: "generated" },
    { key: "bank", label: "Bank Confirmation Letter", category: "Financial", status: "generated" },
    { key: "identity", label: "Authorized Signatory ID", category: "Compliance", status: "required" },
    { key: "sbd1", label: "SBD1 Invitation to Bid", category: "Forms", status: "generated" },
    { key: "sbd4", label: "SBD4 Declaration of Interest", category: "Forms", status: "missing", note: "Awaiting signature." },
    { key: "sbd6", label: "SBD6.1 Preference Claim", category: "Forms", status: "generated" },
  ],
  generatedPdfs: [
    { key: "cover", name: "01-cover-letter.pdf", pages: 2, size: "184 KB", status: "ready" },
    { key: "profile", name: "02-profile-summary.pdf", pages: 4, size: "412 KB", status: "ready" },
    { key: "forms", name: "03-sbd-forms.pdf", pages: 6, size: "1.1 MB", status: "preview" },
    { key: "annexures", name: "04-annexures.pdf", pages: 8, size: "2.4 MB", status: "queued" },
  ],
  missingDocuments: [
    { key: "sbd4", label: "SBD4 Declaration of Interest", category: "Forms", status: "missing", note: "Signature required before pack generation." },
    { key: "witness", label: "Witness Signature", category: "Approvals", status: "missing", note: "Not yet assigned." },
  ],
};

export function getTenderPackProgress(state: TenderPackBuilderState): number {
  return state.progress;
}
