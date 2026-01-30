// src/types/deal.ts

export type DealStage =
  | "lead"
  | "tender"
  | "submitted"
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

  // 🔒 Single source of truth for lock (derived or stored)
  isTenderLocked?: boolean;

  createdAt?: Date | any;
  updatedAt?: Date | any;

  documents?: {
    id: string;
    name: string;
    uploadedAt?: Date | any;
  }[];
}