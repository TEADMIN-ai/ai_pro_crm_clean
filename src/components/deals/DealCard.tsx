"use client";

import React from "react";
import { Deal } from "@/types/deal";
import { STATUS_STYLES } from "@/config/dealStyles";

type Props = {
  deal: Deal;
  onClick?: () => void;
};

export default function DealCard({ deal, onClick }: Props) {
  const stageStyle = STATUS_STYLES[deal.stage];

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 12,
        padding: 16,
        background: "#0f172a", // dark slate
        color: "#e5e7eb",
        boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.15s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform =
          "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{deal.title}</h3>

        <span
          style={{
            ...stageStyle,
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 12,
            textTransform: "capitalize",
            fontWeight: 500,
          }}
        >
          {deal.stage}
        </span>
      </div>

      {/* Client */}
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
        {deal.clientName}
      </div>

      {/* Value */}
      {deal.value !== undefined && (
        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 500 }}>
          {deal.currency ?? "ZAR"}{" "}
          {deal.value.toLocaleString()}
        </div>
      )}
    </div>
  );
}