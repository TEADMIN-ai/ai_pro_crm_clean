import { canEditAuditRole, canViewAuditRole } from "@/lib/audit/auditRoleRules";
import type { UserRole } from "@/lib/auth/roleUtils";

describe("audit permissions", () => {
  test("allows admin and auditor to edit", () => {
    expect(canEditAuditRole("admin")).toBe(true);
    expect(canEditAuditRole("auditor")).toBe(true);
    expect(canEditAuditRole("viewer")).toBe(false);
  });

  test("allows admin, auditor, and viewer to view", () => {
    expect(canViewAuditRole("admin")).toBe(true);
    expect(canViewAuditRole("auditor")).toBe(true);
    expect(canViewAuditRole("viewer")).toBe(true);
    expect(canViewAuditRole("staff" as UserRole)).toBe(false);
  });
});
