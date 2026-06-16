import { compareVehicleFinanceDriverLicenceToIdentityDocument } from "@/lib/vehicle-finance/verification/crossDocumentVerification";
import type {
  VehicleFinanceDriverLicenceExtraction,
  VehicleFinanceDriverLicenceIntelligence,
  VehicleFinanceIdentityDocumentIntelligence,
  VehicleFinanceIdentityStructuredExtraction,
} from "@/types/vehicleFinance";

function buildDriverExtraction(overrides: Partial<VehicleFinanceDriverLicenceExtraction> = {}): VehicleFinanceDriverLicenceExtraction {
  return {
    name: "ACP",
    surname: "LEBATIE",
    idNumber: "8312110051084",
    licenceNumber: "000700832426",
    dateOfBirth: "1983-12-11",
    issueDate: "2011-08-23",
    expiryDate: "2026-03-11",
    licenceCode: "B",
    gender: "FEMALE",
    restriction: "0",
    country: "SOUTH AFRICA",
    confidence: 92,
    fieldConfidence: {
      name: 80,
      surname: 88,
      idNumber: 98,
      licenceNumber: 92,
      dateOfBirth: 92,
      issueDate: 90,
      expiryDate: 92,
      licenceCode: 80,
      gender: 98,
      restriction: 95,
      country: 98,
    },
    fields: {
      name: { value: "ACP", confidence: 80, sourceText: "ACP LEBATIE" },
      surname: { value: "LEBATIE", confidence: 88, sourceText: "ACP LEBATIE" },
      idNumber: { value: "8312110051084", confidence: 98, sourceText: "ID No.: 8312110051084" },
      licenceNumber: { value: "000700832426", confidence: 92, sourceText: "000700832426" },
      dateOfBirth: { value: "1983-12-11", confidence: 92, sourceText: "DOB: 1983-12-11" },
      issueDate: { value: "2011-08-23", confidence: 90, sourceText: "Valid from 23/08/2011 - 11/03/2026" },
      expiryDate: { value: "2026-03-11", confidence: 92, sourceText: "Valid from 23/08/2011 - 11/03/2026" },
      licenceCode: { value: "B", confidence: 80, sourceText: "Licence No. B" },
      gender: { value: "FEMALE", confidence: 98, sourceText: "FEMALE" },
      restriction: { value: "0", confidence: 95, sourceText: "Restriction: 0" },
      country: { value: "SOUTH AFRICA", confidence: 98, sourceText: "SOUTH AFRICA" },
    },
    ...overrides,
  };
}

function buildIdentityExtraction(overrides: Partial<VehicleFinanceIdentityStructuredExtraction> = {}): VehicleFinanceIdentityStructuredExtraction {
  return {
    idNumber: { value: "8312110051084", confidence: 98, sourceText: "I.D. No. 8312110051084" },
    surname: { value: "LEBATIE", confidence: 94, sourceText: "SURNAME LEBATIE" },
    forenames: { value: "ACP", confidence: 94, sourceText: "FORENAMES ACP" },
    dateOfBirth: { value: "1983-12-11", confidence: 92, sourceText: "DATE OF BIRTH 1983-12-11" },
    countryOfBirth: { value: "SOUTH AFRICA", confidence: 97, sourceText: "COUNTRY OF BIRTH SOUTH AFRICA" },
    citizenship: { value: "SA CITIZEN", confidence: 98, sourceText: "SA CITIZEN" },
    dateIssued: { value: "2011-08-23", confidence: 92, sourceText: "DATE ISSUED 2011-08-23" },
    issueNumber: { value: null, confidence: 0, sourceText: "" },
    gender: { value: "FEMALE", confidence: 98, sourceText: "SEX FEMALE" },
    ...overrides,
  };
}

describe("vehicle finance cross document verification", () => {
  test("produces a full match for aligned driver licence and green ID book data", () => {
    const driverLicence: Pick<VehicleFinanceDriverLicenceIntelligence, "extraction"> = {
      extraction: buildDriverExtraction(),
    };
    const identityDocument: Pick<VehicleFinanceIdentityDocumentIntelligence, "documentType" | "extraction"> = {
      documentType: "GREEN_ID_BOOK",
      extraction: buildIdentityExtraction(),
    };

    const verification = compareVehicleFinanceDriverLicenceToIdentityDocument(
      driverLicence,
      identityDocument,
    );

    expect(verification).not.toBeNull();
    expect(verification?.flags).toEqual([
      "ID_MATCH",
      "DOB_MATCH",
      "GENDER_MATCH",
      "SURNAME_MATCH",
      "FORENAME_MATCH",
    ]);
    expect(verification?.fraudFlags).toEqual([]);
    expect(verification?.identityVerificationScore).toBe(100);
    expect(verification?.riskLevel).toBe("LOW");
    expect(verification?.passed).toBe(true);
  });

  test("flags mismatches when identity data diverges", () => {
    const driverLicence: Pick<VehicleFinanceDriverLicenceIntelligence, "extraction"> = {
      extraction: buildDriverExtraction(),
    };
    const identityDocument: Pick<VehicleFinanceIdentityDocumentIntelligence, "documentType" | "extraction"> = {
      documentType: "SMART_ID_CARD",
      extraction: buildIdentityExtraction({
        surname: { value: "SMITH", confidence: 94, sourceText: "SURNAME SMITH" },
      }),
    };

    const verification = compareVehicleFinanceDriverLicenceToIdentityDocument(
      driverLicence,
      identityDocument,
    );

    expect(verification).not.toBeNull();
    expect(verification?.flags).toContain("ID_MATCH");
    expect(verification?.flags).toContain("DOB_MATCH");
    expect(verification?.flags).toContain("GENDER_MATCH");
    expect(verification?.flags).not.toContain("SURNAME_MATCH");
    expect(verification?.fraudFlags).toContain("SURNAME_MISMATCH");
    expect(verification?.identityVerificationScore).toBeLessThan(100);
    expect(verification?.riskLevel).toBe("MEDIUM");
    expect(verification?.passed).toBe(false);
  });
});
