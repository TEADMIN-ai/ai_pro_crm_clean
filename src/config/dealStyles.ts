import { DealStage } from "@/types/deal";

export const STATUS_STYLES: Record<DealStage, React.CSSProperties> = {
  lead: {
    background: "#1e3a8a", // deep blue
    color: "#ffffff",
  },
  tender: {
    background: "#0369a1", // cyan blue
    color: "#ffffff",
  },
  proposal: {
    background: "#4f46e5", // indigo
    color: "#ffffff",
  },
  negotiation: {
    background: "#7c3aed", // violet
    color: "#ffffff",
  },
  won: {
    background: "#15803d", // green
    color: "#ffffff",
  },
  lost: {
    background: "#b91c1c", // red
    color: "#ffffff",
  },
  closed: {
    background: "#374151", // slate
    color: "#ffffff",
  },
};