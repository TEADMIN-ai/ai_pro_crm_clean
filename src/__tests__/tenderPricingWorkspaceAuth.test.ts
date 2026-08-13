import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("tender pricing workspace authenticated client requests", () => {
  const workspaceSource = source("src/components/tender-pricing/TenderPricingWorkspace.tsx");

  test("pricing workspace load uses authenticated request path", () => {
    expect(workspaceSource).toContain("authFetch(`/api/tender-pricing?dealId=");
  });

  test("start mapping uses authenticated request", () => {
    expect(workspaceSource).toContain("authFetch(\"/api/tender-pricing\", {");
    expect(workspaceSource).toContain("method: \"POST\"");
  });

  test("action requests use authenticated request", () => {
    expect(workspaceSource).toContain("authFetch(`/api/tender-pricing/${encodeURIComponent(pricing.id)}`, {");
    expect(workspaceSource).toContain("body: JSON.stringify({ action: actionName, ...body })");
  });

  test("manual price updates use authenticated PATCH request", () => {
    expect(workspaceSource).toContain("authFetch(`/api/tender-pricing/${encodeURIComponent(pricing.id)}`, {");
    expect(workspaceSource).toContain("method: \"PATCH\"");
    expect(workspaceSource).toContain("manualPrices");
  });

  test("all protected tender pricing client calls use authFetch", () => {
    expect(workspaceSource).toContain("import { authFetch } from \"@/lib/client/authFetch\";");
    expect(workspaceSource).toContain("const response = await authFetch");
    expect(workspaceSource).not.toContain("await fetch(");
  });
});

describe("tender pricing backend remains fail-closed", () => {
  test("collection route keeps authentication and privileged role gates", () => {
    const routeSource = source("src/app/api/tender-pricing/route.ts");
    expect(routeSource).toContain("requireAuthorizedUser(request)");
    expect(routeSource).toContain("assertPrivilegedRole(actor)");
    expect(routeSource).toContain("if (error instanceof AuthorizationError) return jsonError(error.message, error.status)");
  });

  test("pricing action route keeps authentication and privileged role gates", () => {
    const routeSource = source("src/app/api/tender-pricing/[pricingId]/route.ts");
    expect(routeSource.match(/requireAuthorizedUser\(request\)/g)).toHaveLength(2);
    expect(routeSource.match(/assertPrivilegedRole\(actor\)/g)).toHaveLength(2);
    expect(routeSource).toContain("if (error instanceof AuthorizationError) return jsonError(error.message, error.status)");
  });
});
