import { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayoutShell from "@/components/layout/DashboardLayout";
import { getStagingBannerState } from "@/lib/server/environmentSafety";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const stagingBanner = getStagingBannerState();

  return (
    <DashboardLayoutShell stagingBanner={stagingBanner.show ? stagingBanner.label : null}>
      <AuthGuard>{children}</AuthGuard>
    </DashboardLayoutShell>
  );
}
