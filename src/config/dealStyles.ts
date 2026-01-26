import type { CSSProperties } from "react";
import type { DealStage } from "@/types/deal";

/**
 * Canonical visual styles per deal stage
 * ⚠️ MUST stay in sync with DealStage union
 */
export const DEAL_STAGE_STYLES: Record<DealStage, CSSProperties> = {
  lead: {
    background: "#1e40af",
    color: "#ffffff",
  },

  tender: {
    background: "#0369a1",
    color: "#ffffff",
  },

  proposal: {
    background: "#4338ca",
    color: "#ffffff",
  },

  negotiation: {
    background: "#7c3aed",
    color: "#ffffff",
  },

  won: {
    background: "#15803d",
    color: "#ffffff",
  },

  lost: {
    background: "#b91c1c",
    color: "#ffffff",
  },
};