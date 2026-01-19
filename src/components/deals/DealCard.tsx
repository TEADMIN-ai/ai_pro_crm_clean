"use client";

import React from "react";

type DealCardProps = {
  title: string;
  status: string;
  assignedTo?: string;
  sla?: string;
};

export default function DealCard({
  title,
  status,
  assignedTo,
  sla,
}: DealCardProps) {
  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={statusStyle(status)}>{status.toUpperCase()}</span>
        {sla && <span style={slaStyle}>{sla}</span>}
      </div>

      <div style={titleStyle}>{title}</div>

      <div style={footerStyle}>
        <div style={avatarStyle}>
          {assignedTo ? assignedTo.slice(0, 2).toUpperCase() : "—"}
        </div>
        <span style={{ opacity: 0.7 }}>
          {assignedTo ? "Assigned" : "Unassigned"}
        </span>
      </div>
    </div>
  );
}

/* ===== Styles ===== */

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 6,
};

const avatarStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 600,
};

const slaStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(0,136,255,0.15)",
};

const statusStyle = (status: string): React.CSSProperties => {
  const map: Record<string, string> = {
    new: "#4da3ff",
    contacted: "#f5c542",
    negotiation: "#b084f5",
    won: "#3bd671",
    lost: "#ff6b6b",
  };

  return {
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 999,
    background: map[status] || "#888",
    color: "#000",
    fontWeight: 600,
  };
};