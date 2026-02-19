export type UserRole = "admin" | "manager" | "staff" | "contractor" | "guest";

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

// Compatibility aliases used by existing callers.
export const canApprove = canReview;
export const canReject = canReview;