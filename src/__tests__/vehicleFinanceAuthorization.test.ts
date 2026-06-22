import { assertVehicleFinanceRole, isVehicleFinanceAuthorizedRole } from "@/lib/server/authz";

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
});
