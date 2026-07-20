import { renderToStaticMarkup } from "react-dom/server";

import ProfilePage from "@/app/dashboard/profile/page";
import DashboardHeader, { getDashboardHeaderRoleLabel } from "@/components/layout/DashboardHeader";
import type { UserRole } from "@/lib/auth/roleUtils";

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

jest.mock("@/components/branding/CorporateBrandMark", () => ({
  __esModule: true,
  default: () => <span>Torque Empire</span>,
}));

function mockDriverAuth() {
  mockUseAuth.mockReturnValue({
    user: {
      uid: "driver-1",
      name: "Driver User",
      displayName: "Driver User",
      email: "driver@example.com",
    },
    role: "driver",
    contractorId: undefined,
    logout: jest.fn(),
  });
}

describe("driver profile access and role labels", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockRequireRole.mockReset();
    mockDriverAuth();
  });

  test("allows drivers to access the profile page", () => {
    renderToStaticMarkup(<ProfilePage />);

    expect(mockRequireRole).toHaveBeenCalledWith(expect.arrayContaining(["driver"]));
  });

  test("renders the Driver role label on the profile page", () => {
    const markup = renderToStaticMarkup(<ProfilePage />);

    expect(markup).toContain("Driver");
  });

  test("resolves and renders the Driver label in DashboardHeader", () => {
    expect(getDashboardHeaderRoleLabel("driver")).toBe("Driver");

    const markup = renderToStaticMarkup(<DashboardHeader />);

    expect(markup).toContain("Driver");
  });
});
