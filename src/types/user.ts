export type UserRole = "admin" | "staff" | "driver" | "contractor" | "manager" | "auditor" | "viewer" | "dealerPilot" | "vehicleFinanceStaff";

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  contractorId?: string;
  status?: string;
  name?: string;
  createdAt: number;
}

