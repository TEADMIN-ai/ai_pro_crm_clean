import { DealStage } from "@/types/deal";
import { CSSProperties } from "react";

export const DEAL_STAGE_STYLES: Record<DealStage, CSSProperties> = {
  lead: { background: "#1e3a8a" },
  tender: { background: "#0369a1" },
  proposal: { background: "#4f46e5" },
  negotiation: { background: "#7c3aed" },
  won: { background: "#15803d" },
  lost: { background: "#b91c1c" },
  closed: { background: "#374151" },
};
