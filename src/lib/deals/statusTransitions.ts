import type { DealStage } from "@/types/deal";
import type { UserRole as AppUserRole } from "@/lib/auth/roleUtils";

export type DealStatus = DealStage;
export type UserRole = Extract<AppUserRole, "admin" | "manager" | "staff" | "contractor">;

type TransitionMap = {
  [role in UserRole]:
    | Partial<Record<DealStage, DealStage[]>>
    | "ANY";
};

export const dealStageTransitions: TransitionMap = {
  admin: "ANY",
  manager: {
    draft: ["in_review", "submitted", "rejected"],
    lead: ["pricing", "manager_review", "rejected"],
    in_review: ["submitted", "awarded", "won", "rejected", "lost"],
    pricing: ["manager_review", "submitted", "rejected"],
    manager_review: ["submitted", "awarded", "won", "rejected", "lost"],
    submitted: ["awarded", "won", "rejected", "lost", "closed"],
    awarded: ["closed"],
    won: ["closed"],
    rejected: ["draft", "closed"],
    lost: ["closed"],
  },
  staff: {
    draft: ["in_review", "submitted"],
    lead: ["pricing", "manager_review"],
    in_review: ["submitted"],
    pricing: ["manager_review", "submitted"],
    manager_review: ["submitted"],
    rejected: ["draft"],
  },
  contractor: {},
};

export function isValidTransition(
  role: UserRole,
  currentStage: DealStage,
  nextStage: DealStage,
): boolean {
  const roleRules = dealStageTransitions[role];

  if (roleRules === "ANY") {
    return true;
  }

  const allowed = roleRules[currentStage];
  return Array.isArray(allowed) && allowed.includes(nextStage);
}
