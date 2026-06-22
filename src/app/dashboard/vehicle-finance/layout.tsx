"use client";

import { ReactNode } from "react";
import RequireRole from "@/components/auth/RequireRole";
import RoarCarsBrandHeader from "@/components/vehicle-finance/RoarCarsBrandHeader";

export default function VehicleFinanceLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole allow={["admin", "manager", "staff", "dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"]}>
      <div className="min-h-screen bg-[#050914]">
        <RoarCarsBrandHeader />
        {children}
      </div>
    </RequireRole>
  );
}
