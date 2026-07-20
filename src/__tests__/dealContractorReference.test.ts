import { getDealContractorReference } from "@/lib/deals/contractorReference";
import {
  getDealContractorDisplayName,
  isDealContractorResolved,
} from "@/lib/deals/contractorReferenceDisplay";

describe("getDealContractorReference", () => {
  it.each([
    ["contractorAssignment.contractorId", { contractorAssignment: { contractorId: "assignment-c" } }, "assignment-c"],
    ["opportunityExecution.contractorId", { opportunityExecution: { contractorId: "execution-c" } }, "execution-c"],
    ["contractorId", { contractorId: "contractor-c" }, "contractor-c"],
    ["assignedContractorId", { assignedContractorId: "assigned-c" }, "assigned-c"],
    ["linkedContractorId", { linkedContractorId: "linked-c" }, "linked-c"],
    ["contractorUid", { contractorUid: "uid-c" }, "uid-c"],
  ] as const)("reads %s", (field, source, value) => {
    expect(getDealContractorReference(source)).toEqual({
      status: "reference_present",
      field,
      value,
    });
  });

  it("uses deterministic precedence across canonical and legacy fields", () => {
    expect(
      getDealContractorReference({
        contractorAssignment: { contractorId: "assignment-c" },
        opportunityExecution: { contractorId: "execution-c" },
        contractorId: "contractor-c",
        assignedContractorId: "assigned-c",
        linkedContractorId: "linked-c",
        contractorUid: "uid-c",
      }),
    ).toEqual({
      status: "reference_present",
      field: "contractorAssignment.contractorId",
      value: "assignment-c",
    });

    expect(
      getDealContractorReference({
        contractorAssignment: { contractorId: "unassigned" },
        opportunityExecution: { contractorId: "execution-c" },
        contractorId: "contractor-c",
      }),
    ).toEqual({
      status: "reference_present",
      field: "opportunityExecution.contractorId",
      value: "execution-c",
    });
  });

  it("ignores blank and sentinel values", () => {
    expect(
      getDealContractorReference({
        contractorAssignment: { contractorId: " " },
        opportunityExecution: { contractorId: "unassigned" },
        contractorId: "N/A",
        assignedContractorId: "null",
        linkedContractorId: "undefined",
        contractorUid: "contractor-c",
      }),
    ).toEqual({
      status: "reference_present",
      field: "contractorUid",
      value: "contractor-c",
    });
  });

  it("returns no_reference when no supported assignment exists", () => {
    expect(getDealContractorReference({ companyId: "company-c" })).toEqual({
      status: "no_reference",
      field: null,
      value: null,
    });
  });
});

describe("contractor reference display", () => {
  it("shows no link, resolved, unresolved, and cross-workspace states", () => {
    expect(getDealContractorDisplayName({ contractorId: null })).toBe("No contractor linked");
    expect(
      getDealContractorDisplayName({
        contractorId: "contractor-c",
        contractorName: "Acme Tenders",
        contractorReferenceResolution: { status: "resolved" },
      }),
    ).toBe("Acme Tenders");
    expect(
      getDealContractorDisplayName({
        contractorId: "missing-c",
        contractorReferenceResolution: { status: "unresolved", failureReason: "not_found" },
      }),
    ).toBe("Linked contractor record could not be resolved.");
    expect(
      getDealContractorDisplayName({
        contractorId: "other-workspace-c",
        contractorReferenceResolution: { status: "unresolved", failureReason: "cross_workspace" },
      }),
    ).toBe("Linked contractor is outside this workspace.");
  });

  it("only marks resolved contractor references as usable", () => {
    expect(
      isDealContractorResolved({
        contractorId: "contractor-c",
        contractorReferenceResolution: { status: "resolved" },
      }),
    ).toBe(true);
    expect(
      isDealContractorResolved({
        contractorId: "contractor-c",
        contractorReferenceResolution: { status: "unresolved", failureReason: "cross_workspace" },
      }),
    ).toBe(false);
  });
});
