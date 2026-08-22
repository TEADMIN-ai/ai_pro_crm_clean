import { readFileSync } from "fs";
import path from "path";
import { NextRequest } from "next/server";

const requireAuthorizedUser = jest.fn();
const assertPrivilegedRole = jest.fn();
const applyOpportunityExecutionAction = jest.fn();
const getOpportunityExecutionView = jest.fn();

class MockAuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

jest.mock("@/lib/server/authz", () => ({
  AuthorizationError: MockAuthorizationError,
  requireAuthorizedUser: (request: unknown) => requireAuthorizedUser(request),
  assertPrivilegedRole: (actor: { role?: string }) => assertPrivilegedRole(actor),
}));

jest.mock("@/server/services/opportunityExecutionService", () => ({
  applyOpportunityExecutionAction: (input: unknown) => applyOpportunityExecutionAction(input),
  getOpportunityExecutionView: (dealId: string, actor: unknown) => getOpportunityExecutionView(dealId, actor),
}));

import { POST } from "@/app/api/opportunity-register/[opportunityId]/execution/route";

const panelSource = readFileSync(
  path.join(process.cwd(), "src/components/opportunity-register/OpportunityExecutionPanel.tsx"),
  "utf8",
);

function request(body: Record<string, unknown>, token?: string) {
  return new NextRequest("https://teos.test/api/opportunity-register/deal-1/execution", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function context(opportunityId = "deal-1") {
  return { params: Promise.resolve({ opportunityId }) };
}

describe("opportunity execution assignment authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assertPrivilegedRole.mockImplementation((actor: { role?: string }) => {
      if (!["admin", "manager", "staff"].includes(actor.role ?? "")) {
        throw new MockAuthorizationError("unauthorized", 403);
      }
    });
    applyOpportunityExecutionAction.mockResolvedValue({ ok: true });
  });

  it("uses authFetch rather than raw fetch for protected execution actions", () => {
    expect(panelSource).toContain('import { authFetch } from "@/lib/client/authFetch";');
    expect(panelSource).toContain("const response = await authFetch(");
    expect(panelSource).not.toContain("const response = await fetch(");
    expect(panelSource).toContain('headers: { "Content-Type": "application/json" }');
    expect(panelSource).toContain("body: JSON.stringify({ action, ...extra })");
  });

  it("sends canonical approved submission evidence ID for Record Submission when available", () => {
    expect(panelSource).toContain('action.key === "record_submission"');
    expect(panelSource).toContain("state.submissionAuthority.approvedSubmissionEvidenceId");
    expect(panelSource).toContain("submissionEvidenceDocumentId: state.submissionAuthority.approvedSubmissionEvidenceId");
  });

  it("returns 401 when no bearer-authenticated actor is available", async () => {
    requireAuthorizedUser.mockRejectedValue(new MockAuthorizationError("unauthorized", 401));

    const response = await POST(request({ action: "assign_contractor", contractorId: "c1" }), context());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "unauthorized" });
    expect(applyOpportunityExecutionAction).not.toHaveBeenCalled();
  });

  it.each(["admin", "manager", "staff"] as const)("lets authenticated %s actor reach execution service", async (role) => {
    const actor = { uid: `${role}-1`, email: `${role}@example.test`, role, workspaceId: "workspace-a" };
    requireAuthorizedUser.mockResolvedValue(actor);

    const response = await POST(request({ action: "assign_contractor", contractorId: "c1" }, "token"), context());

    expect(response.status).toBe(200);
    expect(applyOpportunityExecutionAction).toHaveBeenCalledWith(expect.objectContaining({
      dealId: "deal-1",
      action: "assign_contractor",
      actor,
      contractorId: "c1",
    }));
  });

  it.each(["contractor", "guest"] as const)("returns 403 for authenticated %s role", async (role) => {
    requireAuthorizedUser.mockResolvedValue({ uid: `${role}-1`, email: `${role}@example.test`, role });

    const response = await POST(request({ action: "assign_contractor", contractorId: "c1" }, "token"), context());
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: "unauthorized" });
    expect(applyOpportunityExecutionAction).not.toHaveBeenCalled();
  });

  it("ignores actor identity and assignment metadata supplied in the browser body", async () => {
    const actor = { uid: "staff-verified", email: "staff@example.test", role: "staff", workspaceId: "workspace-a" };
    requireAuthorizedUser.mockResolvedValue(actor);

    await POST(request({
      action: "assign_contractor",
      contractorId: "c1",
      actor: { uid: "spoofed-admin", role: "admin" },
      uid: "spoofed-admin",
      email: "spoofed@example.test",
      role: "admin",
      workspaceId: "workspace-b",
      assignedBy: "spoofed-admin",
      assignedByEmail: "spoofed@example.test",
    }, "token"), context());

    expect(applyOpportunityExecutionAction).toHaveBeenCalledWith({
      dealId: "deal-1",
      action: "assign_contractor",
      actor,
      contractorId: "c1",
      requirements: undefined,
      submission: undefined,
    });
  });
});
