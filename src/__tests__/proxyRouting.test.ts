import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import type { UserRole } from "@/lib/auth/roleUtils";
import { resolveAuthorizedIdentity } from "@/lib/server/authz";
import { verifySessionValue } from "@/lib/server/verifySession";

jest.mock("@/lib/server/verifySession", () => ({ verifySessionValue: jest.fn() }));

jest.mock("@/lib/server/authz", () => {
  class AuthorizationError extends Error {
    status: number;

    constructor(message: string, status = 403) {
      super(message);
      this.name = "AuthorizationError";
      this.status = status;
    }
  }

  return { AuthorizationError, resolveAuthorizedIdentity: jest.fn() };
});

const mockedVerifySessionValue = jest.mocked(verifySessionValue);
const mockedResolveAuthorizedIdentity = jest.mocked(resolveAuthorizedIdentity);

type AuthenticatedRole = Exclude<UserRole, "guest">;

function makeRequest(pathname: string, withSession = true): NextRequest {
  return new NextRequest(`https://example.test${pathname}`, {
    headers: withSession ? { cookie: "session=test-session" } : undefined,
  });
}

function mockAuthenticatedRole(role: AuthenticatedRole): void {
  mockedVerifySessionValue.mockResolvedValue({ uid: `${role}-uid`, email: `${role}@example.test`, role } as never);
  mockedResolveAuthorizedIdentity.mockResolvedValue({ uid: `${role}-uid`, email: `${role}@example.test`, role, profile: null });
}

function expectRedirect(response: Response, pathname: string): void {
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(`https://example.test${pathname}`);
}

function expectNext(response: Response): void {
  expect(response.status).toBe(200);
  expect(response.headers.get("x-middleware-next")).toBe("1");
}

describe("dashboard proxy routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("leaves non-dashboard routes unchanged", async () => {
    const response = await proxy(makeRequest("/login", false));

    expectNext(response);
    expect(mockedVerifySessionValue).not.toHaveBeenCalled();
  });

  test.each([
    ["admin", "/dashboard/admin"],
    ["manager", "/dashboard/manager"],
    ["staff", "/dashboard/staff"],
    ["contractor", "/dashboard/contractor"],
    ["driver", "/dashboard/hygiene/jobs"],
    ["dealerPilot", "/dashboard/vehicle-finance"],
    ["vehicleFinanceStaff", "/dashboard/vehicle-finance"],
    ["ROAR_CARS_STAFF", "/dashboard/vehicle-finance"],
    ["auditor", "/dashboard/profile"],
    ["viewer", "/dashboard/profile"],
  ] as const)("redirects authenticated %s from /dashboard to %s", async (role, destination) => {
    mockAuthenticatedRole(role);

    const response = await proxy(makeRequest("/dashboard"));

    expectRedirect(response, destination);
  });

  test.each(["auditor", "viewer"] as const)("routes %s to an authenticated dashboard destination, not login", async (role) => {
    mockAuthenticatedRole(role);

    const response = await proxy(makeRequest("/dashboard"));

    expectRedirect(response, "/dashboard/profile");
    expect(response.headers.get("location")).not.toBe("https://example.test/login");
  });

  test("preserves contractor routing", async () => {
    mockAuthenticatedRole("contractor");

    expectRedirect(await proxy(makeRequest("/dashboard")), "/dashboard/contractor");
    expectNext(await proxy(makeRequest("/dashboard/contractor")));
  });

  test("preserves driver routing and hygiene restrictions", async () => {
    mockAuthenticatedRole("driver");

    expectRedirect(await proxy(makeRequest("/dashboard")), "/dashboard/hygiene/jobs");
    expectNext(await proxy(makeRequest("/dashboard/hygiene/jobs")));
    expect((await proxy(makeRequest("/dashboard/hygiene"))).status).toBe(403);
  });

  test.each(["dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"] as const)("preserves vehicle-finance routing for %s", async (role) => {
    mockAuthenticatedRole(role);

    expectRedirect(await proxy(makeRequest("/dashboard")), "/dashboard/vehicle-finance");
    expectNext(await proxy(makeRequest("/dashboard/vehicle-finance")));
    expectNext(await proxy(makeRequest("/dashboard/vehicle-finance/applications")));
    expectNext(await proxy(makeRequest("/dashboard/profile")));
    expect((await proxy(makeRequest("/dashboard/deals"))).status).toBe(403);
  });

  test("redirects unauthenticated dashboard requests to login", async () => {
    expectRedirect(await proxy(makeRequest("/dashboard", false)), "/login");

    mockedVerifySessionValue.mockResolvedValue(null);
    expectRedirect(await proxy(makeRequest("/dashboard")), "/login");
  });

  test.each([
    ["admin", "/dashboard/admin"],
    ["manager", "/dashboard/manager"],
    ["staff", "/dashboard/staff"],
    ["contractor", "/dashboard/contractor"],
    ["driver", "/dashboard/hygiene/jobs"],
    ["dealerPilot", "/dashboard/vehicle-finance"],
    ["vehicleFinanceStaff", "/dashboard/vehicle-finance"],
    ["ROAR_CARS_STAFF", "/dashboard/vehicle-finance"],
    ["auditor", "/dashboard/profile"],
    ["viewer", "/dashboard/profile"],
  ] as const)("does not redirect %s already on %s", async (role, pathname) => {
    mockAuthenticatedRole(role);

    const response = await proxy(makeRequest(pathname));

    expectNext(response);
    expect(response.headers.get("location")).toBeNull();
  });

  test.each([
    ["contractor", "/dashboard/contractor"],
    ["driver", "/dashboard/hygiene/jobs"],
    ["dealerPilot", "/dashboard/vehicle-finance"],
    ["vehicleFinanceStaff", "/dashboard/vehicle-finance"],
    ["ROAR_CARS_STAFF", "/dashboard/vehicle-finance"],
    ["auditor", "/dashboard/profile"],
    ["viewer", "/dashboard/profile"],
  ] as const)("prevents redirect loops for %s at %s", async (role, pathname) => {
    mockAuthenticatedRole(role);

    expectNext(await proxy(makeRequest(pathname)));
  });
});
