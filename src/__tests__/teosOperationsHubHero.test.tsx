import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import EnterpriseDashboardHome from "@/components/dashboard/EnterpriseDashboardHome";
import TeosOperationsHubHero from "@/components/dashboard/TeosOperationsHubHero";
import { useAuth } from "@/context/AuthContext";
import { useEnterpriseKpis } from "@/hooks/useEnterpriseKpis";
import type { UserRole } from "@/lib/auth/roleUtils";
import type { EnterpriseKpiSnapshot } from "@/lib/kpis/enterpriseSnapshot";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/useEnterpriseKpis", () => ({
  useEnterpriseKpis: jest.fn(),
}));

jest.mock("@/components/contractors/ContractorOnboardingView", () => ({
  __esModule: true,
  default: ({ contractorId }: { contractorId: string }) => <div>Contractor onboarding {contractorId}</div>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ priority, ...props }: { src: string; alt: string; width: number; height: number; className?: string; sizes?: string; priority?: boolean }) => (
    <img {...props} data-priority={priority ? "true" : undefined} />
  ),
}));

const snapshot: EnterpriseKpiSnapshot = {
  schemaVersion: "2026-07", generatedAt: "2026-07-26T00:00:00.000Z",
  dashboardSummary: { totalOpportunities: 4, readyForSubmission: 2, submitted: 1, blocked: 1, risk: 1, avgReadiness: 74, pipelineValue: 120000, recent: [] },
  opportunities: { total: 4, rfq: 1, tender: 2, rfp: 0, rfi: 0, quotation: 1, unknown: 0, municipalities: 2, closingSoon: 1, overdue: 0, compulsoryBriefings: 1, boqRequired: 2, assigned: 2, unassigned: 2 },
  contractors: { total: 3, ready: 2, compliant: 2, assigned: 1, unassigned: 2, avgReadiness: 70 },
  clients: { total: 1, active: 1, inactive: 0, monthlyRevenue: 0 }, drivers: { total: 1, activeAssignments: 1, collectionsToday: 0, collectionsThisWeek: 1 },
  collections: { total: 1, scheduled: 1, inProgress: 0, completed: 0, overdue: 0, dueThisWeek: 1 }, compliance: { total: 2, valid: 1, expiringSoon: 1, expired: 0 },
  submissions: { total: 4, readyToSubmit: 2, submitted: 1, blocked: 1, avgReadiness: 74, conversionRate: 25 }, revenue: { totalValue: 120000, awardedValue: 0, submittedValue: 20000, pipelineValue: 120000, averageValue: 30000 },
  documents: { total: 5, topLevel: 1, opportunityDocuments: 3, contractorDocuments: 1, uploadedToday: 0 }, readiness: { averageScore: 74, ready: 2, atRisk: 1, notReady: 1 },
};

function renderHero() {
  return renderToStaticMarkup(<TeosOperationsHubHero data={snapshot} readinessScore="74%" submissionRate="25%" />);
}

describe("TEOS operations hub hero", () => {
  test("is imported and rendered by the main dashboard component", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/dashboard/EnterpriseDashboardHome.tsx"), "utf8");
    expect(source).toContain("import TeosOperationsHubHero");
    expect(source).toContain("<TeosOperationsHubHero data={data} readinessScore={readinessScore} submissionRate={submissionRate} />");
  });

  test("renders the optimized image path and concept-visual disclaimer", () => {
    const markup = renderHero();
    expect(markup).toContain("TORQUE EMPIRE OPERATING SYSTEM");
    expect(markup).toContain("One intelligent operating hub. Four divisions. Total control.");
    expect(markup).toContain("/media/teos/teos-operations-hub-hero.webp");
    expect(markup).toContain("Portrait brand concept visual of the Torque Empire Operations Hub digital workspace.");
    expect(markup).toContain("Torque Empire Operations Hub - Brand Concept Visual");
  });

  test("uses useful existing CTA destinations with no current-page self-link", () => {
    const markup = renderHero();
    expect(markup).toContain("href=\"/dashboard/opportunity-register\"");
    expect(markup).toContain("href=\"/dashboard/contractors\"");
    expect(markup).toContain("href=\"/dashboard/hygiene\"");
    expect(markup).not.toContain("href=\"/dashboard\"");
  });

  test("uses scoped dark-surface treatment for heading, copy and metrics", () => {
    const markup = renderHero();
    expect(markup).toContain("tex-dark-surface-hero");
    expect(markup).toContain("tex-dark-surface-hero__metric");
    expect(markup).toContain("Avg Readiness");
    expect(markup).toContain("74%");
    expect(markup).toContain("Submission Rate");
    expect(markup).toContain("25%");
    expect(markup).toContain("Risk Watch");
  });
});

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseEnterpriseKpis = jest.mocked(useEnterpriseKpis);

function renderDashboardFor(role: UserRole) {
  mockedUseAuth.mockReturnValue({ user: role === "guest" ? null : ({ uid: role + "-uid", email: role + "@example.test", role } as never), role, workspace: null, workspaceId: undefined, contractorId: role === "contractor" ? "CON-1" : undefined, capabilities: [], loading: false, error: null, logout: jest.fn() });
  mockedUseEnterpriseKpis.mockReturnValue({ data: snapshot, loading: false, error: null });
  return renderToStaticMarkup(<EnterpriseDashboardHome />);
}

describe("TEOS operations hub runtime integration", () => {
  beforeEach(() => jest.clearAllMocks());
  test("renders on the real EnterpriseDashboardHome admin path before Admin Control Tower", () => {
    const markup = renderDashboardFor("admin");
    expect(markup).toContain("One intelligent operating hub. Four divisions. Total control.");
    expect(markup).toContain("Admin Control Tower");
    expect(markup.indexOf("One intelligent operating hub. Four divisions. Total control.")).toBeLessThan(markup.indexOf("Admin Control Tower"));
  });
  test.each(["manager", "staff"] as const)("renders for %s on the main dashboard role branch", (role) => {
    expect(renderDashboardFor(role)).toContain("One intelligent operating hub. Four divisions. Total control.");
  });
  test.each(["contractor", "driver"] as const)("does not expose the hero to %s", (role) => {
    expect(renderDashboardFor(role)).not.toContain("One intelligent operating hub. Four divisions. Total control.");
  });
  test("CTA destinations exist as dashboard routes", () => {
    for (const routeFile of ["src/app/dashboard/opportunity-register/page.tsx", "src/app/dashboard/contractors/page.tsx", "src/app/dashboard/hygiene/page.tsx"]) {
      expect(fs.existsSync(path.join(process.cwd(), routeFile))).toBe(true);
    }
  });
});
