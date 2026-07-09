import type { Metadata } from "next";

import { ContactPage } from "@/components/corporate/CorporateSite";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Torque Empire for government, enterprise, supplier, and partnership enquiries.",
};

export default function Page() {
  return <ContactPage />;
}
