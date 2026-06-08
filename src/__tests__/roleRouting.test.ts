import { getDashboardPath, getUnauthorizedRedirectPath } from "@/lib/auth/roleRouting";

describe("role dashboard routing", () => {
  test.each([
    ["admin", "/dashboard/admin"],
    ["staff", "/dashboard/staff"],
    ["contractor", "/dashboard/contractor"],
  ] as const)("routes %s to the correct dashboard", (role, expectedPath) => {
    expect(getDashboardPath(role)).toBe(expectedPath);
  });

  test("redirects unauthorized authenticated users to their role dashboard", () => {
    expect(getUnauthorizedRedirectPath("contractor")).toBe("/dashboard/contractor");
    expect(getUnauthorizedRedirectPath("staff")).toBe("/dashboard/staff");
  });

  test("redirects guests to login", () => {
    expect(getUnauthorizedRedirectPath("guest")).toBe("/login");
  });
});
