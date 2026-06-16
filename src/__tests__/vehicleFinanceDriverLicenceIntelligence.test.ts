import { assessVehicleFinanceTextQuality } from "@/lib/vehicle-finance/ocr/textQualityAssessment";
import { classifyVehicleFinanceDocument } from "@/lib/vehicle-finance/classification/documentClassifier";
import { extractDriverLicenceDetails } from "@/lib/vehicle-finance/extractors/driverLicenceExtractor";
import { verifyDriverLicenceExtraction } from "@/lib/vehicle-finance/verification/driverLicenceVerification";

describe("vehicle finance driver licence intelligence", () => {
  test("flags short or corrupted text for OCR fallback", () => {
    const quality = assessVehicleFinanceTextQuality("abc\u0000ï¿½", { confidence: 25, minTextLength: 300 });

    expect(quality.shouldRunOcrFallback).toBe(true);
    expect(quality.flags).toContain("SHORT_TEXT");
    expect(quality.flags).toContain("CORRUPTED_TEXT");
    expect(quality.flags).toContain("LOW_CONFIDENCE");
  });

  test("classifies driver's licence text", () => {
    const classification = classifyVehicleFinanceDocument(`
      Driver's Licence
      Name: John
      Surname: Doe
      Licence Number: DL123456
      Licence Code: B
      Expiry Date: 2030-12-31
    `);

    expect(classification.documentType).toBe("DRIVER_LICENCE");
    expect(classification.confidence).toBeGreaterThan(0);
  });

  test("extracts driver licence details safely", () => {
    const extraction = extractDriverLicenceDetails(`
      Name: John
      Surname: Doe
      ID Number: 9001015009087
      Licence Number: DL123456
      Licence Code: B
      Issue Date: 2020-01-01
      Expiry Date: 2030-12-31
    `);

    expect(extraction.name).toBe("John");
    expect(extraction.surname).toBe("Doe");
    expect(extraction.idNumber).toBe("9001015009087");
    expect(extraction.licenceNumber).toBe("DL123456");
    expect(extraction.expiryDate).toBe("2030-12-31");
    expect(extraction.confidence).toBeGreaterThan(0);
  });

  test("extracts driver licence fields from production OCR text", () => {
    const extraction = extractDriverLicenceDetails(`
      DRIVING LICENCE
      CARTA DE CONDUÇÃO
      ACP LEBATIE
      ID No.: 83121110951084
      FEMALE
      24-10-1983
      Restriction: 0
      000700832426
      Valid from 24/03/2021 - 11/03/2026
      Licence No. 1
      ZA
      SOUTH AFRICA
    `);

    expect(extraction.name).toBe("ACP");
    expect(extraction.surname).toBe("LEBATIE");
    expect(extraction.idNumber).toBe("83121110951084");
    expect(extraction.licenceNumber).toBe("000700832426");
    expect(extraction.issueDate).toBe("24/03/2021");
    expect(extraction.expiryDate).toBe("11/03/2026");
    expect(extraction.licenceCode).toBe("1");
    expect(extraction.gender).toBe("FEMALE");
    expect(extraction.restriction).toBe("0");
    expect(extraction.country).toBe("SOUTH AFRICA");
    expect(extraction.fields?.idNumber.value).toBe("83121110951084");
    expect(extraction.fields?.idNumber.sourceText).toContain("ID No.");
    expect(extraction.fields?.gender.value).toBe("FEMALE");
    expect(extraction.fieldConfidence?.name).toBeGreaterThan(0);
    expect(extraction.fieldConfidence?.licenceNumber).toBeGreaterThan(0);
    expect(extraction.fieldConfidence?.gender).toBeGreaterThan(0);
  });

  test("extracts driver licence fields from valid-to OCR variant", () => {
    const extraction = extractDriverLicenceDetails(`
      DRIVING LICENCE
      CARTA DE CONDUÇÃO
      ADF LEBATE
      ID No.: 248311051084
      DL Card No.: 005700034526
      Valid to: 2026-03-11
      Code: B
      Restrictions: 1
      Surname: LEBATE
      Name: ADP
      Sex: FEMALE
      DOB: 1983-11-05
      ZA
      SOUTH AFRICA
    `);

    expect(extraction.name).toBe("ADP");
    expect(extraction.surname).toBe("LEBATE");
    expect(extraction.idNumber).toBe("248311051084");
    expect(extraction.licenceNumber).toBe("005700034526");
    expect(extraction.expiryDate).toBe("2026-03-11");
    expect(extraction.licenceCode).toBe("B");
    expect(extraction.gender).toBe("FEMALE");
    expect(extraction.country).toBe("SOUTH AFRICA");
    expect(extraction.fieldConfidence?.licenceNumber).toBeGreaterThan(0);
  });

  test("marks soon-to-expire licences with warning flags", () => {
    const soonExpiry = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const verification = verifyDriverLicenceExtraction(
      {
        name: "John",
        surname: "Doe",
        idNumber: "9001015009087",
        licenceNumber: "DL123456",
        issueDate: "2020-01-01",
        expiryDate: soonExpiry,
        licenceCode: "B",
        confidence: 90,
        gender: "MALE",
        restriction: "0",
        country: "SOUTH AFRICA",
        fields: {
          name: { value: "John", confidence: 95, sourceText: "Name: John" },
          surname: { value: "Doe", confidence: 95, sourceText: "Surname: Doe" },
          idNumber: { value: "9001015009087", confidence: 98, sourceText: "ID Number: 9001015009087" },
          licenceNumber: { value: "DL123456", confidence: 95, sourceText: "Licence Number: DL123456" },
          issueDate: { value: "2020-01-01", confidence: 90, sourceText: "Issue Date: 2020-01-01" },
          expiryDate: { value: soonExpiry, confidence: 90, sourceText: `Expiry Date: ${soonExpiry}` },
          licenceCode: { value: "B", confidence: 90, sourceText: "Licence Code: B" },
          gender: { value: "MALE", confidence: 98, sourceText: "MALE" },
          restriction: { value: "0", confidence: 95, sourceText: "Restriction: 0" },
          country: { value: "SOUTH AFRICA", confidence: 98, sourceText: "SOUTH AFRICA" },
        },
      },
      assessVehicleFinanceTextQuality("example text that is long enough to be useful", {
        confidence: 95,
        minTextLength: 300,
      }),
    );

    expect(verification.flags).toContain("LICENCE_EXPIRING_SOON");
  });

  test("verifies driver licence extraction with flags", () => {
    const verification = verifyDriverLicenceExtraction(
      {
        name: "John",
        surname: "Doe",
        idNumber: "9001015009087",
        licenceNumber: "DL123456",
        issueDate: "2020-01-01",
        expiryDate: "2030-12-31",
        licenceCode: "B",
        confidence: 80,
        gender: "MALE",
        restriction: "0",
        country: "SOUTH AFRICA",
        fields: {
          name: { value: "John", confidence: 95, sourceText: "Name: John" },
          surname: { value: "Doe", confidence: 95, sourceText: "Surname: Doe" },
          idNumber: { value: "9001015009087", confidence: 98, sourceText: "ID Number: 9001015009087" },
          licenceNumber: { value: "DL123456", confidence: 95, sourceText: "Licence Number: DL123456" },
          issueDate: { value: "2020-01-01", confidence: 90, sourceText: "Issue Date: 2020-01-01" },
          expiryDate: { value: "2030-12-31", confidence: 90, sourceText: "Expiry Date: 2030-12-31" },
          licenceCode: { value: "B", confidence: 90, sourceText: "Licence Code: B" },
          gender: { value: "MALE", confidence: 98, sourceText: "MALE" },
          restriction: { value: "0", confidence: 95, sourceText: "Restriction: 0" },
          country: { value: "SOUTH AFRICA", confidence: 98, sourceText: "SOUTH AFRICA" },
        },
      },
      assessVehicleFinanceTextQuality("example text that is long enough to be useful", {
        confidence: 80,
        minTextLength: 300,
      }),
    );

    expect(verification.passed).toBe(false);
    expect(verification.flags).toContain("LOW_CONFIDENCE_OCR");
  });
});
