import type { Metadata } from "next";

import { WhyPage } from "@/components/corporate/CorporateSite";

export const metadata: Metadata = {
  title: "Why Torque Empire",
  description: "Why organisations choose Torque Empire for professional services, governance-ready delivery, and technology-first operations.",
};

export default function Page() {
  return <WhyPage />;
}
