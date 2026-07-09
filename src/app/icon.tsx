import { ImageResponse } from "next/og";

import { loadBrandAssetBytes, toDataUri } from "@/lib/branding/assets";
import { TORQUE_EMPIRE_BRAND } from "@/lib/branding/identity";

export const runtime = "nodejs";
export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default async function Icon() {
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
          background: "linear-gradient(145deg, #07111f 0%, #0b2f57 100%)",
        }}
      >
        <img
          src={toDataUri(logo, "image/png")}
          alt={TORQUE_EMPIRE_BRAND.brandName}
          width={512}
          height={512}
          style={{ width: 512, height: 512 }}
        />
      </div>
    ),
    size,
  );
}
