export type DealStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "awaiting_contractor_approval"
  | "approved"
  | "rejected"
  | "archived";

export type UserRole =
  | "admin"
  | "manager"
  | "staff"
  | "contractor";

type TransitionMap = {
  [role in UserRole]: {
    [status in DealStatus]?: DealStatus[];
  } | "ANY";
};

export const dealStatusTransitions: TransitionMap = {
  contractor: {
    draft: ["submitted"],
    rejected: ["draft"],
    approved: ["archived"],
    awaiting_contractor_approval: ["approved"]
  },

  staff: {
    submitted: ["under_review"]
  },

  manager: {
    under_review: [
      "awaiting_contractor_approval",
      "rejected"
    ]
  },

  admin: "ANY"
};

export function isValidTransition(
  role: UserRole,
  currentStatus: DealStatus,
  nextStatus: DealStatus
): boolean {
  const roleRules = dealStatusTransitions[role];

  if (roleRules === "ANY") return true;

  const allowed = roleRules[currentStatus];

  if (!allowed) return false;

  return allowed.includes(nextStatus);
}