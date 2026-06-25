import { assertVehicleFinanceRole, isVehicleFinanceAuthorizedRole } from "@/lib/server/authz";
import { isRoarCarsStaffRole } from "@/lib/auth/roleUtils";

describe("vehicle finance authorization", () => {
  test("recognizes vehicle finance roles", () => {
    expect(isVehicleFinanceAuthorizedRole("dealerPilot")).toBe(true);
    expect(isVehicleFinanceAuthorizedRole("vehicleFinanceStaff")).toBe(true);
    expect(isVehicleFinanceAuthorizedRole("ROAR_CARS_STAFF")).toBe(true);
    expect(isVehicleFinanceAuthorizedRole("admin")).toBe(true);
    expect(isVehicleFinanceAuthorizedRole("contractor")).toBe(false);
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
});
