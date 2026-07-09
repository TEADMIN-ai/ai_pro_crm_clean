import type { MetadataRoute } from "next";

import { TORQUE_EMPIRE_COMPANY_PROFILE } from "@/lib/corporate/companyProfile";

const routes = ["/", "/about-us", "/our-divisions", "/teos-platform", "/why-torque-empire", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = TORQUE_EMPIRE_COMPANY_PROFILE.website;
  const lastModified = new Date();

  return routes.map((route) => ({
    url: base + route,
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
