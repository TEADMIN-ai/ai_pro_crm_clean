import { API_ROUTES } from "@/lib/routes";

describe("API_ROUTES integrity", () => {
  test("CONTRACTORS route is correct", () => {
    expect(API_ROUTES.CONTRACTORS).toBe("/api/contractors");
  });

  test("DEALS route is correct", () => {
    expect(API_ROUTES.DEALS).toBe("/api/deals");
  });

  test("USERS_CREATE route is correct", () => {
    expect(API_ROUTES.USERS_CREATE).toBe("/api/users/create");
  });

  test("RISKS route is correct", () => {
    expect(API_ROUTES.RISKS).toBe("/api/risks");
  });

  test("TENDER_PACK_GENERATE route is correct", () => {
    expect(API_ROUTES.TENDER_PACK_GENERATE).toBe("/api/tender-pack/generate");
  });

  test("CONTRACTOR_DOCUMENTS builds correctly", () => {
    const contractorId = "test123";
    const expected = "/api/contractors/test123/documents";

    expect(API_ROUTES.CONTRACTOR_DOCUMENTS(contractorId)).toBe(expected);
  });

  test("CONTRACTOR_DOCUMENTS never produces singular form", () => {
    const contractorId = "test123";
    const route = API_ROUTES.CONTRACTOR_DOCUMENTS(contractorId);

    expect(route.includes("/api/contractor/")).toBe(false);
  });

  test("RISK_DETAIL builds correctly", () => {
    const riskId = "risk-123";
    expect(API_ROUTES.RISK_DETAIL(riskId)).toBe("/api/risks/risk-123");
  });

  test("AUDIT_PROJECTS route is correct", () => {
    expect(API_ROUTES.AUDIT_PROJECTS).toBe("/api/audits/projects");
  });

  test("AUDIT_LOGS route is correct", () => {
    expect(API_ROUTES.AUDIT_LOGS).toBe("/api/audit-logs");
  });

  test("AUDIT_PROJECT_TASK_DETAIL builds correctly", () => {
    expect(API_ROUTES.AUDIT_PROJECT_TASK_DETAIL("project-1", "task-2")).toBe(
      "/api/audits/projects/project-1/tasks/task-2",
    );
  });

  test("AUDIT_PROJECT_FINDING_DETAIL builds correctly", () => {
    expect(API_ROUTES.AUDIT_PROJECT_FINDING_DETAIL("project-1", "finding-9")).toBe(
      "/api/audits/projects/project-1/findings/finding-9",
    );
  });
});
