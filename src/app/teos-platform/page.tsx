import type { Metadata } from "next";

import { TeosPage } from "@/components/corporate/CorporateSite";

export const metadata: Metadata = {
  title: "TEOS Platform",
  description: "TEOS is the operating platform developed by Torque Empire to simplify operations, improve compliance, and manage business processes.",
};

export default function Page() {
  return <TeosPage />;
}
