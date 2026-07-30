import type { Metadata } from "next";

import { HomePage } from "@/components/corporate/CorporateSite";
import StandaloneRootRedirect from "@/components/pwa/StandaloneRootRedirect";

export const metadata: Metadata = {
  title: "Torque Empire",
  description:
    "Torque Empire delivers procurement, hygiene and waste management, telecommunications, and automotive support, backed by the secure TEOS operating platform.",
};

export default function Page() {
  return (
    <>
      <StandaloneRootRedirect />
      <HomePage />
    </>
  );
}
