"use client";

import { useAuth } from "@/context/AuthContext";
import { isRoarCarsStaffRole } from "@/lib/auth/roleUtils";
import RoarCarsStaffDashboard from "@/components/vehicle-finance/RoarCarsStaffDashboard";
import VehicleFinanceOperationsDashboard from "@/components/vehicle-finance/VehicleFinanceOperationsDashboard";

export default function VehicleFinanceDashboardRouter() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6 text-sm text-slate-300" role="status">
        Loading Roar Cars workspace…
      </div>
    );
  }

  return isRoarCarsStaffRole(role) ? <RoarCarsStaffDashboard /> : <VehicleFinanceOperationsDashboard />;
}
