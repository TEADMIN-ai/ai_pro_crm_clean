"use client";

import { ReactNode } from "react";
import RequireRole from "@/components/auth/RequireRole";

export default function VehicleFinanceLayout({ children }: { children: ReactNode }) {
  return <RequireRole allow={["admin", "manager", "staff", "dealerPilot", "vehicleFinanceStaff"]}>{children}</RequireRole>;
}
