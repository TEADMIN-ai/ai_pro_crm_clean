export type ContractorTier = "basic" | "bronze" | "silver" | "gold" | "platinum";

export interface Contractor {
  id: string;
  name?: string | null;
  companyName?: string | null;
  companyRegistrationNumber?: string | null;
  bbbeeLevel?: string | null;
  taxPin?: string | null;
  taxpayerName?: string | null;
  taxClearanceExpiry?: number | null;
  coidaRegistrationNumber?: string | null;
  coidaExpiry?: number | null;
  bankVerified?: boolean | null;
  bankName?: string | null;
  bankAccountHolder?: string | null;
  bankAccountNumber?: string | null;
  bankBranchCode?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  tier?: ContractorTier | null;
  submissionsUsed?: number | null;
  submissionsLimit?: number | null;
  readinessScore?: number | null;
  docsMissing?: number | null;
  tenderLockStatus?: "READY" | "RISK" | "BLOCKED" | null;
  isTenderLocked?: boolean | null;
  createdAt?: number | null;
  createdBy?: string | null;
  updatedAt?: string | null;
}
