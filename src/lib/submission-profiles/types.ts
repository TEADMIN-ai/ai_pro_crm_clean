export type SubmissionProfileKey =
  | "government"
  | "municipal"
  | "private"
  | "corporate"
  | "construction";

export type SubmissionPackKey =
  | "government_submission"
  | "contractor_review_pack"
  | "internal_operations_pack";

export type SubmissionDocumentRequirement = {
  key: string;
  label: string;
  mandatory: boolean;
  note?: string;
};
export type SubmissionFormRequirement = {
  key: string;
  label: string;
  mandatory: boolean;
  note?: string;
};

export type SubmissionAnnexure = {
  key: string;
  label: string;
  note?: string;
};

export type SubmissionSignatureRequirement = {
  role: string;
  count: number;
  note?: string;
};

export type SubmissionValidationRule = {
  key: string;
  label: string;
  detail: string;
};
export type SubmissionProfileDefinition = {
  key: SubmissionProfileKey;
  label: string;
  audience: string;
  summary: string;
  readinessClassification: string;
  requiredDocuments: SubmissionDocumentRequirement[];
  requiredForms: SubmissionFormRequirement[];
  annexures: SubmissionAnnexure[];
  namingConvention: string;
  pageOrder: string[];
  validationRules: SubmissionValidationRule[];
  signatureRequirements: SubmissionSignatureRequirement[];
};
export type SubmissionPackAudience = "external" | "contractor" | "internal";

export type SubmissionPackSection = {
  title: string;
  detail: string;
  items: string[];
};
export type SubmissionPackDefinition = {
  key: SubmissionPackKey;
  title: string;
  audience: SubmissionPackAudience;
  summary: string;
  includeBranding: boolean;
  includeAiPages: boolean;
  includeWorkflowPages: boolean;
  sections: SubmissionPackSection[];
};

export type SubmissionProfilePackSet = {
  profile: SubmissionProfileDefinition;
  packs: SubmissionPackDefinition[];
};
