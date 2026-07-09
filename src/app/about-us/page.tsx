import type { Metadata } from "next";

import { AboutPage } from "@/components/corporate/CorporateSite";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Torque Empire vision, mission, values, leadership, growth strategy, and community impact.",
};

export default function Page() {
  return <AboutPage />;
}
