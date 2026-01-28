// src/types/deal.ts

export type DealStage =
  | "lead"
  | "tender"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  value: number;
  currency?: "ZAR";

  companyId?: string;
  assignedTo?: string | null;
  clientName?: string;

  isTenderLocked?: boolean; // 🔒 SINGLE SOURCE OF TRUTH

  createdAt?: Date | any;
  updatedAt?: Date | any;

  documents?: {
    id: string;
    name: string;
    uploadedAt?: Date | any;
  }[];
}