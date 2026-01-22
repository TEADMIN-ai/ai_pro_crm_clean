import type { Timestamp } from "firebase/firestore";

export type DealStage =
  | "lead"
  | "tender"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "closed";

export interface Deal {
  id: string;

  // Common fields (many are optional because early deals may not have them yet)
  title?: string;
  clientName?: string;
  description?: string;

  // Money fields (optional)
  value?: number;
  currency?: string;

  // Pipeline stage
  stage?: DealStage;

  // Ownership / assignment
  companyId?: string;
  ownerId?: string | null; // (your rules use ownerId)
  assignedTo?: string | null; // (some screens use assignedTo)
  createdBy?: string;

  // Lifecycle flags
  isArchived?: boolean;

  // Timestamps (optional in early data)
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}