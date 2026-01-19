import { Timestamp } from "firebase/firestore";

/**
 * Deal lifecycle stages (canonical)
 * Used by:
 * - Firestore
 * - KPI cards
 * - Kanban
 * - Styling
 */
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

  title: string;
  clientName: string;
  description?: string;

  value?: number;
  currency?: string;

  stage: DealStage;

  ownerId: string;       // assigned staff UID
  createdBy: string;     // creator UID
  companyId: string;

  isArchived: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}