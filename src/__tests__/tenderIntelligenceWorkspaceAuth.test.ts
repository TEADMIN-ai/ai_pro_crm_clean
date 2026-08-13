import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("tender intelligence workspace authenticated client requests", () => {
  const workspaceSource = source("src/components/tender-intelligence/TenderIntelligenceWorkspace.tsx");

  test("workspace load uses authenticated request path", () => {
    expect(workspaceSource).toContain("authFetch(`/api/tender-intelligence/${encodeURIComponent(dealId)}`)");
  });

  test("start analysis and refresh after amendment use authenticated requests", () => {
    expect(workspaceSource).toContain("const endpoint = refreshAfterAmendment");
    expect(workspaceSource).toContain("/refresh`");
    expect(workspaceSource).toContain("authFetch(endpoint, { method: \"POST\" })");
  });

  test("review update uses authenticated PATCH request", () => {
    expect(workspaceSource).toContain("authFetch(`/api/tender-intelligence/${encodeURIComponent(dealId)}/review`, {");
    expect(workspaceSource).toContain("method: \"PATCH\"");
  });

  test("approval and rejection actions use authenticated requests", () => {
    expect(workspaceSource).toContain("authFetch(`/api/tender-intelligence/${encodeURIComponent(dealId)}/approve`, { method: \"POST\" })");
    expect(workspaceSource).toContain("authFetch(`/api/tender-intelligence/${encodeURIComponent(dealId)}/reject`, {");
  });
  test("all protected tender intelligence client calls use authFetch", () => {
    expect(workspaceSource).toContain("import { authFetch } from \"@/lib/client/authFetch\";");
    expect(workspaceSource).toContain("const response = await authFetch");
    expect(workspaceSource).not.toContain("await fetch(");
  });
});

describe("tender intelligence backend remains fail-closed", () => {
  const routeFiles = [
    "src/app/api/tender-intelligence/[dealId]/route.ts",
    "src/app/api/tender-intelligence/[dealId]/refresh/route.ts",
    "src/app/api/tender-intelligence/[dealId]/review/route.ts",
    "src/app/api/tender-intelligence/[dealId]/approve/route.ts",
    "src/app/api/tender-intelligence/[dealId]/reject/route.ts",
  ];
  test("all protected routes keep authentication gates", () => {
    routeFiles.forEach((routeFile) => {
      const routeSource = source(routeFile);
      expect(routeSource).toContain("requireAuthorizedUser(request)");
      expect(routeSource).toContain("if (error instanceof AuthorizationError) return jsonError(error.message, error.status)");
    });
  });
});
