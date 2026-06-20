import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Torque Empire",
    short_name: "Torque",
    description: "Torque Empire AI-Pro CRM mobile operations workspace.",
    start_url: "/dashboard/hygiene/jobs",
    scope: "/",
    display: "standalone",
    background_color: "#102A56",
    theme_color: "#102A56",
    icons: [
      {
        src: "/images/logos/TE%20IN%20Partnership%20With%20Roar%20logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/logos/TE%20IN%20Partnership%20With%20Roar%20logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
