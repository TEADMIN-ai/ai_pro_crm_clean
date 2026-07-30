import type { MetadataRoute } from "next";

import { TORQUE_EMPIRE_COMPANY_PROFILE } from "@/lib/corporate/companyProfile";
import { publicRoutes } from "@/lib/corporate/websiteContent";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = TORQUE_EMPIRE_COMPANY_PROFILE.website;
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: base + route,
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
