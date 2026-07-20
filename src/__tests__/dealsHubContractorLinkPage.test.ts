import { readFileSync } from "fs";
import path from "path";

const source = readFileSync(
  path.join(process.cwd(), "src/app/dashboard/deals/page.tsx"),
  "utf8",
);

describe("Deals Hub contractor link UI wiring", () => {
  it("keeps the no-contractor state visible and blocks pack generation until resolution", () => {
    expect(source).toContain("Not linked");
    expect(source).toContain("This deal is not linked to a contractor. Actions are restricted.");
    expect(source).toContain("Generate Pack is disabled because this deal has no linked contractor.");
    expect(source).toContain("isDealContractorResolved(selectedDeal)");
  });

  it("gates assignment controls to authorised roles through the shared helper", () => {
    expect(source).toContain("canManageDealContractorLink(role)");
    expect(source).toContain("canManageContractorLink && selectedDeal");
    expect(source).toContain("aria-label=\"Select contractor to link\"");
  });

  it("uses confirmation before changing an existing contractor link", () => {
    expect(source).toContain("window.confirm(\"Change the linked contractor for this deal?\")");
  });

  it("uses the canonical opportunity execution assignment action and refreshes deal state", () => {
    expect(source).toContain("buildAssignContractorRequest(nextContractorId)");
    expect(source).toContain("`${API_ROUTES.OPPORTUNITY_REGISTER}/${encodeURIComponent(selectedDeal.id)}/execution`");
    expect(source).toContain("await loadData(true);");
    expect(source).toContain("await loadSelectedContractor(nextContractorId);");
  });

  it("prevents duplicate assignment submissions while a link request is in flight", () => {
    expect(source).toContain("setIsAssigningContractor(true)");
    expect(source).toContain("disabled={isLoadingContractors || isAssigningContractor || !assignmentContractorId.trim()}");
  });
});
