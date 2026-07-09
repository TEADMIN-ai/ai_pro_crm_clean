import { ImageResponse } from "next/og";

import { loadBrandAssetBytes, toDataUri } from "@/lib/branding/assets";
import { TORQUE_EMPIRE_BRAND } from "@/lib/branding/identity";

export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const logo = await loadBrandAssetBytes("torque-empire-primary.png");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #07111f 0%, #0b2f57 60%, #07111f 100%)",
          padding: "64px 72px",
          color: "#ffffff",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: "66%" }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#d9e2ec",
            }}
          >
            {TORQUE_EMPIRE_BRAND.brandName}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 26, fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>
            Four Divisions.
            <br />
            One Vision. Total Excellence.
          </div>
          <div style={{ marginTop: 20, fontSize: 28, lineHeight: 1.4, color: "#d7e0ea" }}>
            South African technology and professional services for procurement, hygiene, telecommunications, and TEOS.
          </div>
        </div>

        <div
          style={{
            width: 420,
            height: 420,
            borderRadius: 64,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
          }}
        >
          <img
            src={toDataUri(logo, "image/png")}
            alt={TORQUE_EMPIRE_BRAND.brandName}
            width={420}
            height={420}
            style={{ width: 420, height: 420 }}
          />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

