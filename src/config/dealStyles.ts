// src/config/dealStyles.ts

import type { CSSProperties } from "react";
import type { DealStage } from "@/types/deal";

export const dealStageStyles: Record<DealStage, CSSProperties> = {
  lead: {
    background: "#e0f2fe",
  },
  tender: {
    background: "#ede9fe",
  },
  proposal: {
    background: "#dcfce7",
  },
  negotiation: {
    background: "#fef9c3",
  },
  won: {
    background: "#bbf7d0",
  },
  lost: {
    background: "#fee2e2",
  },
};