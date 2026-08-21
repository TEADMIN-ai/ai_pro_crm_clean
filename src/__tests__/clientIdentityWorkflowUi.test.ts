import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("deal client identity workflow UI", () => {
  test("missing client identity exposes Verify Client Identity from Tender Pricing", () => {
    const tenderPricing = source("src/components/tender-pricing/TenderPricingWorkspace.tsx");
    expect(tenderPricing).toContain("Client identity required");
    expect(tenderPricing).toContain("Verify Client Identity");
    expect(tenderPricing).toContain("/client-identity");
    expect(tenderPricing).toContain("clientIdentityCanonicalId");
  });

  test("deal-scoped workflow uses governed APIs without typed canonical ID entry", () => {
    const workflow = source("src/components/client-identity/DealClientIdentityWorkflow.tsx");
    expect(workflow).toContain("/api/deals/${encodeURIComponent(dealId)}/client-identity");
    expect(workflow).toContain("action, canonicalId");
    expect(workflow).toContain("create_candidate");
    expect(workflow).toContain("link_verified");
    expect(workflow).toContain("/api/master-data/client/${encodeURIComponent(candidate.canonicalId)}/verify");
    expect(workflow).toContain("Create Client Candidate");
    expect(workflow).toContain("Verify Client");
    expect(workflow).toContain("Link Client to Opportunity");
    expect(workflow).not.toContain("<input");
  });
});
