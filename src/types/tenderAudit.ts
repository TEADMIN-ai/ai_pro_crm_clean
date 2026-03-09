export type DocumentAnalysis = {
  registrationNumber?: string;
  documentType?: string;
  expiryDate?: string;
  confidence?: number;
  expired?: boolean;
  duplicate?: boolean;
};

export type TenderEvaluation = {
  readinessScore: number;
  complianceStatus: "PASS" | "WARNING" | "FAIL";
  riskFlags: string[];
  missingRequirements: string[];
  recommendations: string[];
};

export type TenderAuditEvent = {
  id: string;
  message: string;
  createdAt: Date;
  userId: string;
};
