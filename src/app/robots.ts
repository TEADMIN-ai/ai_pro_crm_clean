import type { MetadataRoute } from "next";

import { TORQUE_EMPIRE_COMPANY_PROFILE } from "@/lib/corporate/companyProfile";

export default function robots(): MetadataRoute.Robots {
  const base = TORQUE_EMPIRE_COMPANY_PROFILE.website;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/login/", "/portal/"],
      },
    ],
    sitemap: base + "/sitemap.xml",
    host: base,
  };
}
