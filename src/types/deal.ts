export type DealStage =
  | "lead"
  | "tender"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";
export type Deal = {
  id: string;

  // Business
  title: string;
  companyName?: string;
  clientName?: string;

  // Revenue
  value: number;              // ALWAYS number (0 if unknown)
  currency: "ZAR" | "USD";    // extend later if needed

  // Pipeline
  stage: DealStage;
  probability?: number;       // 0–100 (optional but powerful)
  expectedCloseDate?: string; // ISO string

  // Ownership
  ownerId?: string;           // staff / manager UID
  createdBy: string;          // UID
  companyId: string;

  // System
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
};