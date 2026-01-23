"use client";

import React from "react";

type HeroBannerProps = {
  title: string;
  subtitle?: string;
  role: "admin" | "manager" | "staff" | "deals";
};

const bannerMap: Record<HeroBannerProps["role"], string> = {
  admin: "/images/banners/admin.jpg",
  manager: "/images/banners/manager.jpg",
  staff: "/images/banners/staff.jpg",
  deals: "/images/banners/deals.jpg",
};

export default function HeroBanner({ title, subtitle, role }: HeroBannerProps) {
  return (
    <div style={{ ...containerStyle, backgroundImage: `url(${bannerMap[role]})` }}>
      <div style={overlayStyle}>
        <h1 style={titleStyle}>{title}</h1>
        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      </div>
    </div>
  );
}

/* ===== Styles ===== */

const containerStyle: React.CSSProperties = {
  height: 220,
  borderRadius: 20,
  backgroundSize: "cover",
  backgroundPosition: "center",
  marginBottom: 32,
  overflow: "hidden",
};

const overlayStyle: React.CSSProperties = {
  height: "100%",
  width: "100%",
  background:
    "linear-gradient(135deg, rgba(8,15,30,0.92), rgba(8,15,30,0.75))",
  padding: 32,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const titleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 8,
  opacity: 0.85,
};
