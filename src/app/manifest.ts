import type { MetadataRoute } from "next";

import { TORQUE_EMPIRE_BRAND } from "@/lib/branding/identity";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: TORQUE_EMPIRE_BRAND.platformName,
    short_name: TORQUE_EMPIRE_BRAND.shortName,
    description: TORQUE_EMPIRE_BRAND.description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: TORQUE_EMPIRE_BRAND.colors.surface,
    theme_color: TORQUE_EMPIRE_BRAND.colors.blue,
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/logo/favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/corporate/logo/torque-empire-primary.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
