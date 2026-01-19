"use client";

type Deal = {
  id?: string;
  title?: string;
  status?: string;
  assignedTo?: string;
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

export default function DealCard({ deal }: { deal?: Deal }) {
  // ✅ HARD GUARD — never crash the UI
  if (!deal) return null;

  const statusKey =
    typeof deal.status === "string"
      ? deal.status.toLowerCase()
      : "new";

  const style =
    STATUS_STYLES[statusKey] ?? STATUS_STYLES["new"];

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
      {/* STATUS BADGE */}
      <div
        style={{
          alignSelf: "flex-start",
          padding: "4px 10px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.6,
          background: style.bg,
          color: "#fff",
          boxShadow: style.glow,
          animation:
            statusKey === "new"
              ? "pulse 2s infinite"
              : "none",
        }}
      >
        {style.label}
      </div>

      {/* TITLE */}
      <div style={{ fontWeight: 600, fontSize: 15 }}>
        {deal.title || "Untitled Deal"}
      </div>

      {/* ASSIGNED */}
      <div
        style={{
          fontSize: 13,
          opacity: 0.7,
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

      {/* PULSE ANIMATION */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            box-shadow: ${style.glow};
          }
          50% {
            box-shadow: 0 0 20px rgba(255,255,255,0.6);
          }
          100% {
            box-shadow: ${style.glow};
          }
        }
      `}</style>
    </div>
  );
}