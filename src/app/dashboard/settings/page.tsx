"use client";

import { useAuth } from "@/context/AuthContext";
import { isVehicleFinanceRole } from "@/lib/auth/roleUtils";

export default function SettingsPage() {
  const { role } = useAuth();
  const isRoarCarsWorkspace = isVehicleFinanceRole(role);

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl font-semibold">{isRoarCarsWorkspace ? "Dealer Settings" : "System Settings"}</h1>
      <p className="text-sm text-slate-400">
        {isRoarCarsWorkspace
          ? "Configure Roar Cars workspace and account preferences."
          : "Configure system preferences and user roles."}
      </p>
    </div>
  );
}
