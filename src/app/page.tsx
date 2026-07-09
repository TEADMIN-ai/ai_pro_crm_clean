import type { Metadata } from "next";

import { HomePage } from "@/components/corporate/CorporateSite";

export const metadata: Metadata = {
  title: "Torque Empire",
  description:
    "Torque Empire is a technology-driven company delivering procurement, hygiene and waste management, telecommunications, and TEOS business technology.",
};

export default function Page() {
  return <HomePage />;
}