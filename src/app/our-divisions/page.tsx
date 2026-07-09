import type { Metadata } from "next";

import { DivisionsPage } from "@/components/corporate/CorporateSite";

export const metadata: Metadata = {
  title: "Our Divisions",
  description: "Explore Torque Empire divisions across procurement, hygiene and waste management, telecommunications, and TEOS business technology.",
};

export default function Page() {
  return <DivisionsPage />;
}
