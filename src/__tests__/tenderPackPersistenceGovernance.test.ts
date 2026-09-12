import { readFileSync } from "node:fs";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("tender pack persistence governance", () => {
  test("governed tender-pack POST persists with canonical commercial authority identifiers", () => {
    const route = source("src/app/api/tender-pack/generate/route.ts");

    expect(route).toContain("const approvedClientQuote = await assertApprovedClientQuote");
    expect(route).toContain("dealId: deal.id");
    expect(route).toContain("opportunityId: deal.id");
    expect(route).toContain("workspaceId: governedWorkspaceId");
    expect(route).toContain("clientQuoteId: approvedClientQuote.clientQuoteId");
    expect(route).toContain("registerTenderPackDocument");
  });

  test("governed tender-pack GET persists with canonical commercial authority identifiers", () => {
    const route = source("src/app/api/tender-pack/route.ts");

    expect(route).toContain("const approvedClientQuote = await assertApprovedClientQuote");
    expect(route).toContain("dealId: deal.id");
    expect(route).toContain("opportunityId: deal.id");
    expect(route).toContain("workspaceId: governedWorkspaceId");
    expect(route).toContain("clientQuoteId: approvedClientQuote.clientQuoteId");
    expect(route).toContain("registerTenderPackDocument");
  });

  test("legacy tender generate fails closed before governed persistence without Client_Quote_ID", () => {
    const route = source("src/app/api/tender/generate/route.ts");

    expect(route).toContain("clientQuoteId?: string");
    expect(route).toContain("if (!clientQuoteId)");
    expect(route).toContain("CLIENT_QUOTE_NOT_APPROVED");
    expect(route).toContain("const approvedClientQuote = await assertApprovedClientQuote");
    expect(route).toContain("opportunityId");
    expect(route).toContain("workspaceId: governedWorkspaceId");
    expect(route).toContain("clientQuoteId: approvedClientQuote.clientQuoteId");
  });

  test("generic SBD4 generation does not fabricate governed tender-pack persistence identifiers", () => {
    const route = source("src/app/api/sbd4/generate/route.ts");

    expect(route).not.toContain("persistTenderPackPdf");
    expect(route).not.toContain("clientQuoteId");
    expect(route).toContain("assertCanAccessContractor(user, contractorId)");
  });
});
