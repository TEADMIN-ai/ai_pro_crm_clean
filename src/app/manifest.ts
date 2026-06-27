import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Torque Empire AI Pro CRM",
    short_name: "Torque AI",
    description: "Torque Empire AI Pro CRM executive operations workspace.",
    id: "/",
    start_url: "/dashboard/hygiene/jobs",
    scope: "/",
    display: "standalone",
    background_color: "#071426",
    theme_color: "#071426",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
