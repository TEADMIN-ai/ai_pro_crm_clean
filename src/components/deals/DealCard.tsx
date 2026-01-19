"use client";

import SlaProgress from "./SlaProgress";

type Deal = {
  id: string;
  title?: string;
  status?: string;
  assignedTo?: string;
  slaDueAt?: any;
};

const STATUS_STYLES: Record<
  string,
  { card: React.CSSProperties; badge: React.CSSProperties }
> = {
  new: {
    card: {
      background: "rgba(255,255,255,0.04)",
      borderRadius: 14,
      padding: 16,
    },
    badge: {
      background: "#3b82f6",
      color: "#fff",
      fontSize: 11,
      padding: "2px 8px",
      borderRadius: 999,
      marginBottom: 6,
      display: "inline-block",
    },
  },
  contacted: {
    card: {
      background: "rgba(255,255,255,0.04)",
      borderRadius: 14,
      padding: 16,
    },
    badge: {
      background: "#6366f1",
      color: "#fff",
      fontSize: 11,
      padding: "2px 8px",
      borderRadius: 999,
      marginBottom: 6,
      display: "inline-block",
    },
  },
  negotiation: {
    card: {
      background: "rgba(255,255,255,0.04)",
      borderRadius: 14,
      padding: 16,
    },
    badge: {
      background: "#f59e0b",
      color: "#000",
      fontSize: 11,
      padding: "2px 8px",
      borderRadius: 999,
      marginBottom: 6,
      display: "inline-block",
    },
  },
  won: {
    card: {
      background: "rgba(34,197,94,0.12)",
      borderRadius: 14,
      padding: 16,
    },
    badge: {
      background: "#22c55e",
      color: "#000",
      fontSize: 11,
      padding: "2px 8px",
      borderRadius: 999,
      marginBottom: 6,
      display: "inline-block",
    },
  },
  lost: {
    card: {
      background: "rgba(239,68,68,0.12)",
      borderRadius: 14,
      padding: 16,
    },
    badge: {
      background: "#ef4444",
      color: "#fff",
      fontSize: 11,
      padding: "2px 8px",
      borderRadius: 999,
      marginBottom: 6,
      display: "inline-block",
    },
  },
};

export default function DealCard({ deal }: { deal: Deal }) {
  const safeStatus = deal.status ?? "new";
  const style =
    STATUS_STYLES[safeStatus] ?? STATUS_STYLES["new"];

  return (
    <div style={style.card}>
      <div style={style.badge}>
        {safeStatus.toUpperCase()}
      </div>

      <div style={{ fontWeight: 600 }}>
        {deal.title ?? "Untitled Deal"}
      </div>

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        {deal.assignedTo ? "Assigned" : "Unassigned"}
      </div>

      <SlaProgress slaDueAt={deal.slaDueAt} />
    </div>
  );
}