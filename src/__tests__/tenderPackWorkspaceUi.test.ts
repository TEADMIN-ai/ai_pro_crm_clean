import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("deal-scoped Tender Pack workspace UI wiring", () => {
  test("execution next-action and stage URLs include dealId", () => {
    const projection = source("src/lib/opportunities/procurementExecutionProjection.ts");
    const execution = source("src/lib/opportunities/opportunityExecution.ts");
    const panel = source("src/components/opportunity-register/ProcurementExecutionProjectionPanel.tsx");

    expect(projection).toContain("/dashboard/tender-pack-requests?dealId=");
    expect(projection).toContain("encodeURIComponent(input.state.dealId)");
    expect(execution).toContain("/dashboard/tender-pack-requests?dealId=");
    expect(execution).toContain("encodeURIComponent(String(source.id ?? \"\"))");
    expect(panel).toContain("href: \"/dashboard/tender-pack-requests?dealId=\" + encodeURIComponent(projection.dealId)");
  });

  test("Tender Pack route passes deal context into the builder", () => {
    const page = source("src/app/dashboard/tender-pack-requests/page.tsx");

    expect(page).toContain("searchParams?: Promise<{ dealId?: string; requestId?: string }>");
    expect(page).toContain("dealId={params.dealId}");
    expect(page).toContain("requestId={params.requestId}");
  });

  test("connected workspace uses governed read and generate APIs", () => {
    const builder = source("src/components/tender/TenderPackBuilderWorkspace.tsx");

    expect(builder).toContain("/api/tender-pack/workspace?dealId=");
    expect(builder).toContain("state.generationEndpoint");
    expect(builder).toContain("state.generationPayload");
    expect(builder).toContain("Generate Tender Pack");
    expect(builder).not.toContain("Production data required");
    expect(builder).not.toContain("generate_tender_pack");
  });

  test("generation route keeps server-side Client Quote and Tender Pack authority", () => {
    const route = source("src/app/api/tender-pack/generate/route.ts");

    expect(route).toContain("if (!clientQuoteId) throw new Error(\"Missing clientQuoteId\")");
    expect(route).toContain("assertApprovedClientQuote({ opportunityId: deal.id, clientQuoteId, actor: user })");
    expect(route).toContain("resolveVerifiedTenderPackDocument({ opportunityId: deal.id, workspaceId, documentId: tenderPackDocumentId })");
  });

  test("no-context route keeps a safe empty state", () => {
    const builder = source("src/components/tender/TenderPackBuilderWorkspace.tsx");

    expect(builder).toContain("No deal context");
    expect(builder).toContain("Open this workspace from a governed opportunity execution action");
  });
});

