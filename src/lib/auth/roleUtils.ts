export type UserRole =
  | "admin"
  | "manager"
  | "staff"
  | "driver"
  | "contractor"
  | "auditor"
  | "viewer"
  | "dealerPilot"
  | "vehicleFinanceStaff"
  | "ROAR_CARS_STAFF"
  | "guest";

export function isVehicleFinanceRole(role?: UserRole): boolean {
  return role === "dealerPilot" || role === "vehicleFinanceStaff" || role === "ROAR_CARS_STAFF";
}

export function isRoarCarsStaffRole(role?: UserRole): boolean {
  return role === "ROAR_CARS_STAFF";
}

export function isVehicleFinanceStaffRole(role?: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "staff" || role === "vehicleFinanceStaff" || role === "ROAR_CARS_STAFF";
}

export function canUpload(role?: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "staff" || role === "contractor";
}

export function canReview(role?: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canDelete(role: UserRole | undefined, docUploadedByUid: string | undefined, currentUid: string | undefined): boolean {
  if (role === "admin" || role === "manager") {
    return true;
  }

  if (!currentUid || !docUploadedByUid) {
    return false;
  }

  return (role === "staff" || role === "contractor") && docUploadedByUid === currentUid;
}

export function canCreateDeal(role?: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function canSubmitDeal(role?: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function canUploadContractorDocs(role: UserRole) {
  return ["admin", "manager", "staff", "contractor"].includes(role);
}

export function canViewContractorList(role?: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function canViewContractorProfile(role?: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "staff" || role === "contractor";
}

export function canAccessVehicleFinance(role?: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "staff" || isVehicleFinanceRole(role);
}

// Compatibility aliases used by existing callers.
export const canApprove = canReview;
export const canReject = canReview;
