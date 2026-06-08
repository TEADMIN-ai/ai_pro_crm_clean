import { canCreateTenderPackRequest } from "@/server/services/tenderPackRequestService";
import { TENDER_PACK_REQUEST_STATUSES } from "@/types/tenderPackRequest";
import type { AuthorizedUser } from "@/lib/server/authz";

function user(role: AuthorizedUser["role"], contractorId?: string): AuthorizedUser {
  return {
    uid: `${role}-uid`,
    email: `${role}@example.com`,
    role,
    contractorId,
  };
}

describe("tender pack request workflow rules", () => {
  test("defines the operational status lifecycle", () => {
    expect(TENDER_PACK_REQUEST_STATUSES).toEqual([
      "pending",
      "under_review",
      "approved",
      "generated",
      "rejected",
    ]);
  });

  test("allows contractors to create requests only for their own contractor profile", () => {
    expect(canCreateTenderPackRequest(user("contractor", "contractor-1"), "contractor-1")).toBe(true);
    expect(canCreateTenderPackRequest(user("contractor", "contractor-1"), "contractor-2")).toBe(false);
  });

  test("allows privileged users to create requests for contractors", () => {
    expect(canCreateTenderPackRequest(user("admin"), "contractor-1")).toBe(true);
    expect(canCreateTenderPackRequest(user("staff"), "contractor-1")).toBe(true);
  });
});
