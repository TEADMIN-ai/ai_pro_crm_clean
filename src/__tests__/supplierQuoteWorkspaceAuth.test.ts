import { readFileSync } from "node:fs";
import path from "node:path";
import { authFetch } from "@/lib/client/authFetch";

jest.mock("@/lib/firebase", () => ({ auth: { currentUser: { getIdToken: jest.fn(async () => "supplier-token") } } }));

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("supplier quote workspace authenticated client requests", () => {
  const workspaceSource = source("src/components/supplier-quotes/SupplierQuoteWorkspace.tsx");

  test("uses authenticated request path for quote loading and comparison", () => {
    expect(workspaceSource).toContain("authFetch(`/api/supplier-quotes?dealId=");
    expect(workspaceSource).toContain("&view=comparison`)");
    expect(workspaceSource).not.toMatch(/[^A-Za-z]fetch\(`/);
  });

  test("uses authenticated multipart upload without forcing application/json Content-Type", () => {
    expect(workspaceSource).toContain("authFetch(\"/api/supplier-quotes\", { method: \"POST\", body: formData })");
    expect(workspaceSource).not.toContain("multipart/form-data");
  });

  test("uses authenticated fetch for approval decisions", () => {
    expect(workspaceSource).toContain("/approval");
    expect(workspaceSource).toContain("const response = await authFetch");
  });

  test("uses authenticated fetch for pricing handoff", () => {
    expect(workspaceSource).toContain("/pricing");
    expect(workspaceSource).toContain("authFetch");
  });
});

describe("supplier quote authFetch FormData behavior", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("multipart supplier quote upload receives Authorization header and no forced JSON Content-Type", async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const formData = new FormData();
    formData.set("dealId", "deal-1");

    await authFetch("/api/supplier-quotes", { method: "POST", body: formData });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer supplier-token");
    expect(headers.get("Content-Type")).toBeNull();
  });
});

describe("supplier quote backend remains fail-closed", () => {
  test("route keeps authentication and privileged role gates", () => {
    const routeSource = source("src/app/api/supplier-quotes/route.ts");
    expect(routeSource).toContain("requireAuthorizedUser(request)");
    expect(routeSource).toContain("assertPrivilegedRole(actor)");
    expect(routeSource).toContain("if (error instanceof AuthorizationError) return jsonError(error.message, error.status)");
  });
});
