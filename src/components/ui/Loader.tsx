"use client";

import { EnterpriseLoadingState } from "@/components/ui/EnterpriseUI";

export function Loader({ label = "Loading..." }: { label?: string }) {
  return <EnterpriseLoadingState label={label} />;
}
