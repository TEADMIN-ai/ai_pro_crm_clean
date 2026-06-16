import { assessVehicleFinanceTextQuality } from "@/lib/vehicle-finance/ocr/textQualityAssessment";
import { classifyVehicleFinanceDocument } from "@/lib/vehicle-finance/classification/documentClassifier";
import { extractDriverLicenceDetails } from "@/lib/vehicle-finance/extractors/driverLicenceExtractor";
import { verifyDriverLicenceExtraction } from "@/lib/vehicle-finance/verification/driverLicenceVerification";

describe("vehicle finance driver licence intelligence", () => {
  test("flags short or corrupted text for OCR fallback", () => {
    const quality = assessVehicleFinanceTextQuality("abc\u0000�", { confidence: 25, minTextLength: 300 });

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
