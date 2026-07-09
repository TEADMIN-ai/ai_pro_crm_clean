import { ImageResponse } from "next/og";

import { loadBrandAssetBytes, toDataUri } from "@/lib/branding/assets";
import { TORQUE_EMPIRE_BRAND } from "@/lib/branding/identity";

export const runtime = "nodejs";
export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default async function AppleIcon() {
  const logo = await loadBrandAssetBytes("favicon.png");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07111f",
        }}
      >
        <img
          src={toDataUri(logo, "image/png")}
          alt={TORQUE_EMPIRE_BRAND.brandName}
          width={180}
          height={180}
          style={{ width: 180, height: 180 }}
        />
      </div>
    ),
    size,
  );
}
