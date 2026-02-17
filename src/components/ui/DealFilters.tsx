import React from "react";

type DealFiltersProps = {
  status: string;
  onStatusChange: (value: string) => void;
};

const STATUSES = [
  "all",
  "new",
  "contacted",
  "negotiation",
  "won",
  "lost",
];

export default function DealFilters({
  status,
  onStatusChange,
}: DealFiltersProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      {STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => onStatusChange(s)}
          style={{
            padding: "8px 14px",
            borderRadius: 20,
            border: "none",
            cursor: "pointer",
            background:
              status === s
                ? "rgba(255,255,255,0.15)"
                : "rgba(255,255,255,0.05)",
            color: "white",
            fontSize: 13,
            textTransform: "capitalize",
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

