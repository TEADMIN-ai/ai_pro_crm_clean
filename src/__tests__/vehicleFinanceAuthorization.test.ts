import { buildUserProfile } from "@/lib/auth/userProfile";
import { assertVehicleFinancePartnerRole, assertVehicleFinanceRole, isVehicleFinanceAuthorizedRole, resolveAuthorizedIdentity } from "@/lib/server/authz";
import { isRoarCarsStaffRole } from "@/lib/auth/roleUtils";

describe("vehicle finance authorization", () => {
  test("recognizes vehicle finance roles", () => {
    expect(isVehicleFinanceAuthorizedRole("dealerPilot")).toBe(true);
    expect(isVehicleFinanceAuthorizedRole("vehicleFinanceStaff")).toBe(true);
    expect(isVehicleFinanceAuthorizedRole("ROAR_CARS_STAFF")).toBe(true);
    expect(isVehicleFinanceAuthorizedRole("admin")).toBe(true);
    expect(isVehicleFinanceAuthorizedRole("contractor")).toBe(false);
    expect(isVehicleFinanceAuthorizedRole("vehicleFinancePartner")).toBe(false);
  });

  test("asserts vehicle finance access for eligible roles", () => {
    expect(() => assertVehicleFinanceRole({ role: "dealerPilot" } as never)).not.toThrow();
    expect(() => assertVehicleFinanceRole({ role: "vehicleFinanceStaff" } as never)).not.toThrow();
    expect(() => assertVehicleFinanceRole({ role: "ROAR_CARS_STAFF" } as never)).not.toThrow();
  });

  test("selects the dedicated Roar Cars staff workspace only for its exact role", () => {
    expect(isRoarCarsStaffRole("ROAR_CARS_STAFF")).toBe(true);
    expect(isRoarCarsStaffRole("vehicleFinanceStaff")).toBe(false);
    expect(isRoarCarsStaffRole("staff")).toBe(false);
  });
  test("requires an authenticated supplier link for partner portal access", () => {
    expect(() => assertVehicleFinancePartnerRole({ role: "vehicleFinancePartner", vehicleFinanceSupplierId: "supplier-a" } as never)).not.toThrow();
    expect(() => assertVehicleFinancePartnerRole({ role: "vehicleFinancePartner" } as never)).toThrow("unauthorized");
    expect(() => assertVehicleFinancePartnerRole({ role: "vehicleFinanceStaff", vehicleFinanceSupplierId: "supplier-a" } as never)).toThrow("unauthorized");
  });

  test("hydrates the canonical vehicle finance supplier link from a user profile", () => {
    expect(buildUserProfile({ role: "vehicleFinancePartner", vehicleFinanceSupplierId: " supplier-a " })).toMatchObject({
      role: "vehicleFinancePartner",
      vehicleFinanceSupplierId: "supplier-a",
    });
  });

  test("resolves a linked vehicle finance partner to its canonical supplier", async () => {
    const profile = buildUserProfile({ role: "vehicleFinancePartner", vehicleFinanceSupplierId: "supplier-a" });
    const identity = await resolveAuthorizedIdentity({ uid: "partner-user", profile });

    expect(identity).toMatchObject({ role: "vehicleFinancePartner", vehicleFinanceSupplierId: "supplier-a" });
    expect(() => assertVehicleFinancePartnerRole(identity)).not.toThrow();
  });

  test("fails closed when a vehicle finance partner has no canonical supplier link", async () => {
    const identity = await resolveAuthorizedIdentity({ uid: "partner-user", profile: buildUserProfile({ role: "vehicleFinancePartner" }) });

    expect(identity.vehicleFinanceSupplierId).toBeUndefined();
    expect(() => assertVehicleFinancePartnerRole(identity)).toThrow("unauthorized");
  });

  test("does not grant partner access to non-partner roles with a supplier link", async () => {
    const identity = await resolveAuthorizedIdentity({ uid: "staff-user", profile: buildUserProfile({ role: "vehicleFinanceStaff", vehicleFinanceSupplierId: "supplier-a" }) });

    expect(() => assertVehicleFinancePartnerRole(identity)).toThrow("unauthorized");
  });
});
