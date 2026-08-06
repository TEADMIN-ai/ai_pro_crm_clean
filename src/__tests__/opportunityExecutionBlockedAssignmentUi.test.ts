import { readFileSync } from "fs";
import path from "path";

const source = readFileSync(
  path.join(process.cwd(), "src/components/opportunity-register/OpportunityExecutionPanel.tsx"),
  "utf8",
);

describe("blocked contractor assignment presentation", () => {
  it("keeps Assign available only for an explicitly allowed contractor", () => {
    expect(source).toContain("match.assignmentAllowed === true");
    expect(source).toContain('onClick={() => submit("assign_contractor", { contractorId: match.contractorId })}');
    expect(source).toContain('variant="success"');
  });

  it("uses Review Blockers instead of a misleading blocked Assign action", () => {
    expect(source).toContain("Review Blockers");
    expect(source).not.toContain('title={match.blockingReasons[0] ?? undefined}>Assign</EnterpriseActionButton>');
    expect(source).toContain('aria-controls={"contractor-blockers-" + match.contractorId}');
  });

  it("keeps server-provided blocker reasons accessible", () => {
    expect(source).toContain("match.blockingReasons.map");
    expect(source).toContain('aria-label={"Assignment blockers for " + match.contractorName}');
    expect(source).toContain("window.requestAnimationFrame");
  });

  it("does not calculate assignment eligibility in the browser", () => {
    expect(source).not.toContain("readinessScore >=");
    expect(source).not.toContain("complianceScore >=");
    expect(source).toContain("match.assignmentAllowed === true");
  });
});
