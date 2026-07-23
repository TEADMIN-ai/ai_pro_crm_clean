import {
  getBusinessFacingContractorReference,
  getCipcRegistrationNumber,
  getCsdSupplierNumber,
} from "@/lib/contractors/contractorReferencePresentation";

const rawUid = "z0yX8cyt38hkfa6OUEyNTOiX2812";

describe("contractor reference presentation", () => {
  it("does not display Firebase Auth UID, document ID, linked user ID, or contractorId as the contractor reference", () => {
    expect(getBusinessFacingContractorReference({ id: rawUid, contractorId: rawUid, uid: rawUid })).toBe(
      "Contractor reference not issued",
    );
    expect(getBusinessFacingContractorReference({ id: "contractor-doc", linkedUserId: rawUid, contractorReference: rawUid })).toBe(
      "Contractor reference not issued",
    );
  });

  it("displays an existing canonical TEOS contractor reference", () => {
    expect(getBusinessFacingContractorReference({ id: "contractor-doc", teosContractorReference: "TEOS-CON-00042" })).toBe(
      "TEOS-CON-00042",
    );
  });

  it("does not use business name, email, email local-part, or personal name as a reference", () => {
    expect(getBusinessFacingContractorReference({ id: "c1", contractorReference: "Mackay Civil", companyName: "Mackay Civil" })).toBe(
      "Contractor reference not issued",
    );
    expect(getBusinessFacingContractorReference({ id: "c1", contractorReference: "ops@example.com", email: "ops@example.com" })).toBe(
      "Contractor reference not issued",
    );
    expect(getBusinessFacingContractorReference({ id: "c1", contractorReference: "ops", email: "ops@example.com" })).toBe(
      "Contractor reference not issued",
    );
    expect(getBusinessFacingContractorReference({ id: "c1", contractorReference: "Mr K", name: "Mr K" })).toBe(
      "Contractor reference not issued",
    );
  });

  it("keeps CIPC and CSD identifiers in their own fields", () => {
    const contractor = {
      id: "contractor-doc",
      registrationNumber: "2018/123456/07",
      csdNumber: "MAAA000111",
    };

    expect(getBusinessFacingContractorReference(contractor)).toBe("Contractor reference not issued");
    expect(getCipcRegistrationNumber(contractor)).toBe("2018/123456/07");
    expect(getCsdSupplierNumber(contractor)).toBe("MAAA000111");
  });
});

