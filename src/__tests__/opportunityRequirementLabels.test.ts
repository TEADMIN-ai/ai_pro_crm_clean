import { readFileSync } from "fs";
import path from "path";

import { formatOpportunityRequirementLabel } from "@/components/opportunity-register/OpportunityExecutionPanel";

describe("opportunity requirement labels", () => {
  it("maps known internal keys to readable labels", () => {
    expect(formatOpportunityRequirementLabel("csdRequirement")).toBe("CSD registration");
    expect(formatOpportunityRequirementLabel("taxRequirement")).toBe("Tax compliance");
    expect(formatOpportunityRequirementLabel("bbbeeRequirement")).toBe("B-BBEE evidence");
    expect(formatOpportunityRequirementLabel("coidaRequirement")).toBe("COIDA / Letter of Good Standing");
    expect(formatOpportunityRequirementLabel("bankingRequirement")).toBe("Bank confirmation");
    expect(formatOpportunityRequirementLabel("boqPricingSchedulePresent")).toBe("BOQ / pricing schedule");
    expect(formatOpportunityRequirementLabel("signatureRequired")).toBe("Required signatures");
  });

  it("uses a safe fallback for unknown keys", () => {
    expect(formatOpportunityRequirementLabel("newRequirementKey")).toBe("New Requirement Key");
    expect(formatOpportunityRequirementLabel("new_requirement-key")).toBe("New Requirement Key");
  });

  it("keeps the blocked-assignment UI contract intact", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/opportunity-register/OpportunityExecutionPanel.tsx"),
      "utf8",
    );
    expect(source).toContain("Review Blockers");
    expect(source).toContain("match.assignmentAllowed === true");
    expect(source).toContain("{formatOpportunityRequirementLabel(key)}");
  });
});