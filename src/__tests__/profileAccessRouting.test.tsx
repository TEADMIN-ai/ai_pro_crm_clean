import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";

import ProfilePage from "@/app/dashboard/profile/page";
import { proxy } from "@/proxy";
import type { UserRole } from "@/lib/auth/roleUtils";
import { resolveAuthorizedIdentity } from "@/lib/server/authz";
import { verifySessionValue } from "@/lib/server/verifySession";

const mockUseAuth = jest.fn();
const mockRequireRole = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/components/auth/RequireRole", () => ({
  __esModule: true,
  default: ({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) => {
    mockRequireRole(allow);
    return children;
  },
}));

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

type ProfileRole = "auditor" | "viewer";

function makeDashboardRequest(): NextRequest {
  return new NextRequest("https://example.test/dashboard", {
    headers: { cookie: "session=test-session" },
  });
}

function mockAuthenticatedProfileRole(role: ProfileRole): void {
  mockedVerifySessionValue.mockResolvedValue({ uid: `${role}-uid`, email: `${role}@example.test`, role } as never);
  mockedResolveAuthorizedIdentity.mockResolvedValue({ uid: `${role}-uid`, email: `${role}@example.test`, role, profile: null });
  mockUseAuth.mockReturnValue({
    user: {
      uid: `${role}-uid`,
      name: `${role} User`,
      displayName: `${role} User`,
      email: `${role}@example.test`,
    },
    role,
    contractorId: undefined,
    logout: jest.fn(),
  });
}

describe("profile destination access routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReset();
    mockRequireRole.mockReset();
  });

  test.each(["auditor", "viewer"] as const)("allows authenticated %s flow from /dashboard to /dashboard/profile", async (role) => {
    mockAuthenticatedProfileRole(role);

    const response = await proxy(makeDashboardRequest());
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/dashboard/profile");

    const markup = renderToStaticMarkup(<ProfilePage />);
    expect(mockRequireRole).toHaveBeenCalledWith(expect.arrayContaining([role]));
    expect(markup).toContain(role === "auditor" ? "Auditor" : "Viewer");
  });

  test.each(["auditor", "viewer"] as const)("keeps %s profile access limited to personal account actions", (role) => {
    mockAuthenticatedProfileRole(role);

    const markup = renderToStaticMarkup(<ProfilePage />);

    expect(markup).toContain("My Profile");
    expect(markup).toContain("Change Password");
    expect(markup).toContain("Logout");
    expect(markup).not.toContain("/dashboard/users");
    expect(markup).not.toContain("Create Contractor User");
    expect(markup).not.toContain("Admin Control Tower");
  });
});
