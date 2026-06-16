"use client";

import { ReactNode } from "react";
import RequireRole from "@/components/auth/RequireRole";

export default function VehicleFinanceTrainingLayout({ children }: { children: ReactNode }) {
  return <RequireRole allow={["admin", "manager", "staff", "vehicleFinanceStaff"]}>{children}</RequireRole>;
}
