import { readFileSync } from "fs";
import path from "path";

const requireAuthorizedUserFromSession = jest.fn();
const getOpportunityExecutionView = jest.fn();

jest.mock("@/lib/server/authz", () => ({
  requireAuthorizedUserFromSession: () => requireAuthorizedUserFromSession(),
}));
jest.mock("@/server/services/opportunityExecutionService", () => ({
  getOpportunityExecutionView: (dealId: string, actor: unknown) => getOpportunityExecutionView(dealId, actor),
}));
jest.mock("@/components/opportunity-register/OpportunityWorkspaceView", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/opportunity-register/opportunityRegisterData", () => ({
  getOpportunityRegisterRecordById: () => null,
  mapDealToOpportunityRegisterRecord: (deal: unknown) => deal,
}));

import OpportunityRegisterDetailPage from "@/app/dashboard/opportunity-register/[opportunityId]/page";

const actor = {
  uid: "staff-verified",
  email: "staff@example.test",
  role: "staff" as const,
  workspaceId: "workspace-a",
};

describe("Opportunity Workspace actor context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthorizedUserFromSession.mockResolvedValue(actor);
    getOpportunityExecutionView.mockResolvedValue({
      deal: { id: "deal-1", title: "Opportunity" },
      state: { requirements: {}, currentPhase: "MATCHING_REQUIRED" },
      matches: [],
    });
  });

  test("passes the server-verified actor to the execution view", async () => {
    await OpportunityRegisterDetailPage({ params: Promise.resolve({ opportunityId: "deal-1" }) });

    expect(requireAuthorizedUserFromSession).toHaveBeenCalledTimes(1);
    expect(getOpportunityExecutionView).toHaveBeenCalledWith("deal-1", actor);
  });

  test.each([
    ["src/app/dashboard/opportunity-register/[opportunityId]/page.tsx", "opportunityId"],
    ["src/app/dashboard/deals/[dealId]/execution/page.tsx", "dealId"],
    ["src/app/dashboard/deals/[dealId]/tender-pricing/page.tsx", "dealId"],
    ["src/app/dashboard/deals/[dealId]/supplier-quotes/page.tsx", "dealId"],
  ])("does not source authority context from browser metadata in %s", (relativePath, idName) => {
    const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");

    expect(source).toContain("requireAuthorizedUserFromSession");
    expect(source).not.toContain("searchParams");
    expect(source).not.toContain("query");
    expect(source).not.toContain("body");
    expect(source).toContain(`getOpportunityExecutionView(${idName}, actor)`);
  });
});