"use client";

type Deal = {
  id?: string;
  title?: string;
  status?: string;
  assignedTo?: string;
  slaDueAt?: any; // Firestore Timestamp | Date | undefined
};

const STATUS_STYLES: Record<
  string,
  { label: string; bg: string; glow: string }
> = {
  new: {
    label: "NEW",
    bg: "#2563eb",
    glow: "0 0 12px rgba(37,99,235,0.8)",
  },
  contacted: {
    label: "CONTACTED",
    bg: "#06b6d4",
    glow: "0 0 12px rgba(6,182,212,0.8)",
  },
  negotiation: {
    label: "NEGOTIATION",
    bg: "#f59e0b",
    glow: "0 0 12px rgba(245,158,11,0.8)",
  },
  won: {
    label: "WON",
    bg: "#16a34a",
    glow: "0 0 14px rgba(22,163,74,0.9)",
  },
  lost: {
    label: "LOST",
    bg: "#dc2626",
    glow: "0 0 14px rgba(220,38,38,0.9)",
  },
};

function getSlaInfo(slaDueAt?: any) {
  if (!slaDueAt) return null;

  const due =
    typeof slaDueAt.toDate === "function"
      ? slaDueAt.toDate()
      : new Date(slaDueAt);

  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 0) {
    return {
      label: "SLA Breached",
      color: "#dc2626",
      glow: "0 0 14px rgba(220,38,38,0.9)",
      pulse: true,
    };
  }

  if (diffMinutes <= 60) {
    return {
      label: `${diffMinutes} min left`,
      color: "#f59e0b",
      glow: "0 0 12px rgba(245,158,11,0.8)",
      pulse: true,
    };
  }

  const hours = Math.floor(diffMinutes / 60);
  return {
    label: `${hours}h left`,
    color: "#16a34a",
    glow: "0 0 10px rgba(22,163,74,0.7)",
    pulse: false,
  };
}

export default function DealCard({ deal }: { deal?: Deal }) {
  if (!deal) return null;

  const statusKey =
    typeof deal.status === "string"
      ? deal.status.toLowerCase()
      : "new";

  const statusStyle =
    STATUS_STYLES[statusKey] ?? STATUS_STYLES["new"];

  const sla = getSlaInfo(deal.slaDueAt);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* STATUS */}
      <div
        style={{
          alignSelf: "flex-start",
          padding: "4px 10px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          background: statusStyle.bg,
          color: "#fff",
          boxShadow: statusStyle.glow,
        }}
      >
        {statusStyle.label}
      </div>

      {/* TITLE */}
      <div style={{ fontWeight: 600, fontSize: 15 }}>
        {deal.title || "Untitled Deal"}
      </div>

      {/* ASSIGNED */}
      <div
        style={{
          fontSize: 13,
          opacity: 0.75,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {deal.assignedTo
            ? deal.assignedTo.slice(0, 2).toUpperCase()
            : "—"}
        </span>
        {deal.assignedTo ? "Assigned" : "Unassigned"}
      </div>

      {/* SLA */}
      {sla && (
        <div
          style={{
            marginTop: 6,
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            background: sla.color,
            boxShadow: sla.glow,
            animation: sla.pulse ? "pulse 1.8s infinite" : "none",
          }}
        >
          {sla.label}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}