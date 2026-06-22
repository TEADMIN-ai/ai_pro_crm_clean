import { getDashboardPath, getUnauthorizedRedirectPath, isRoarCarsDashboardPath } from "@/lib/auth/roleRouting";

describe("role dashboard routing", () => {
  test.each([
    ["admin", "/dashboard/admin"],
    ["staff", "/dashboard/staff"],
    ["contractor", "/dashboard/contractor"],
    ["dealerPilot", "/dashboard/vehicle-finance"],
    ["vehicleFinanceStaff", "/dashboard/vehicle-finance"],
    ["ROAR_CARS_STAFF", "/dashboard/vehicle-finance"],
  ] as const)("routes %s to the correct dashboard", (role, expectedPath) => {
    expect(getDashboardPath(role)).toBe(expectedPath);
  });

  test("redirects unauthorized authenticated users to their role dashboard", () => {
    expect(getUnauthorizedRedirectPath("contractor")).toBe("/dashboard/contractor");
    expect(getUnauthorizedRedirectPath("staff")).toBe("/dashboard/staff");
    expect(getUnauthorizedRedirectPath("dealerPilot")).toBe("/dashboard/vehicle-finance");
    expect(getUnauthorizedRedirectPath("vehicleFinanceStaff")).toBe("/dashboard/vehicle-finance");
    expect(getUnauthorizedRedirectPath("ROAR_CARS_STAFF")).toBe("/dashboard/vehicle-finance");
  });

  test.each([
    "/dashboard/vehicle-finance",
    "/dashboard/vehicle-finance/inventory",
    "/dashboard/vehicle-finance/listings",
    "/dashboard/vehicle-finance/applications",
    "/dashboard/vehicle-finance/customers",
    "/dashboard/vehicle-finance/reports",
    "/dashboard/settings",
    "/dashboard/profile",
  ])("allows Roar Cars staff to access %s", (pathname) => {
    expect(isRoarCarsDashboardPath(pathname)).toBe(true);
  });

  test.each([
    "/dashboard/deals",
    "/dashboard/contractors",
    "/dashboard/tender-pack-requests",
    "/dashboard/intelligence",
    "/dashboard/governance",
    "/dashboard/vehicle-finance/document-verification",
    "/dashboard/vehicle-finance/training",
  ])("blocks Roar Cars staff from accessing %s", (pathname) => {
    expect(isRoarCarsDashboardPath(pathname)).toBe(false);
  });

  test("redirects guests to login", () => {
    expect(getUnauthorizedRedirectPath("guest")).toBe("/login");
  });
});
