import { assessVehicleFinanceTextQuality } from "@/lib/vehicle-finance/ocr/textQualityAssessment";
import { classifyVehicleFinanceDocument } from "@/lib/vehicle-finance/classification/documentClassifier";
import { extractDriverLicenceDetails } from "@/lib/vehicle-finance/extractors/driverLicenceExtractor";
import { extractGreenIdBookDetails } from "@/lib/vehicle-finance/extractors/greenIdBookExtractor";
import { extractSmartIdCardDetails } from "@/lib/vehicle-finance/extractors/smartIdCardExtractor";
import { verifyIdentityExtraction } from "@/lib/vehicle-finance/verification/identityVerification";
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
    expect(extraction.dateOfBirth).toBe("24-10-1983");
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
        dateOfBirth: "1990-01-01",
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
          dateOfBirth: { value: "1990-01-01", confidence: 90, sourceText: "Date of Birth: 1990-01-01" },
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
        dateOfBirth: "1990-01-01",
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
          dateOfBirth: { value: "1990-01-01", confidence: 90, sourceText: "Date of Birth: 1990-01-01" },
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

  test("extracts green ID book intelligence", () => {
    const extraction = extractGreenIdBookDetails(`
      I.D. No.
      8312110051084
      SURNAME
      LEBATIE
      FORENAMES
      AGNETHA CARMON PATRICIA
      COUNTRY OF BIRTH
      SOUTH AFRICA
      DATE OF BIRTH
      1983-12-11
      DATE ISSUED
      2011-08-23
      SA CITIZEN
      PHOTO
      BARCODE
    `);

    expect(extraction.documentType).toBe("GREEN_ID_BOOK");
    expect(extraction.idNumber.value).toBe("8312110051084");
    expect(extraction.surname.value).toBe("LEBATIE");
    expect(extraction.forenames.value).toContain("AGNETHA");
    expect(extraction.countryOfBirth.value).toBe("SOUTH AFRICA");
    expect(extraction.citizenship.value).toBe("SA CITIZEN");
    expect(extraction.dateOfBirth.value).toBe("1983-12-11");
    expect(extraction.dateIssued.value).toBe("2011-08-23");
    expect(extraction.integrityIndicators.photoDetected).toBe(true);
    expect(extraction.integrityIndicators.barcodeDetected).toBe(true);
  });

  test("extracts smart ID card intelligence", () => {
    const extraction = extractSmartIdCardDetails(`
      IDENTITY NUMBER
      9001015009087
      SURNAME
      DOE
      NAMES
      JOHN HENRY
      SEX
      MALE
      DATE OF BIRTH
      1990-01-01
      ISSUE NUMBER
      A1234567
      NATIONALITY
      SOUTH AFRICA
      PHOTO
      CARD NO 1234567890
    `);

    expect(extraction.documentType).toBe("SMART_ID_CARD");
    expect(extraction.idNumber.value).toBe("9001015009087");
    expect(extraction.surname.value).toBe("DOE");
    expect(extraction.forenames.value).toContain("JOHN");
    expect(extraction.gender.value).toBe("MALE");
    expect(extraction.dateOfBirth.value).toBe("1990-01-01");
    expect(extraction.issueNumber.value).toBe("A1234567");
    expect(extraction.citizenship.value).toBe("SOUTH AFRICA");
    expect(extraction.integrityIndicators.photoDetected).toBe(true);
    expect(extraction.integrityIndicators.cardNumberDetected).toBe(true);
  });

  test("verifies identity extraction with missing fields", () => {
    const verification = verifyIdentityExtraction({
      idNumber: { value: null, confidence: 0, sourceText: "" },
      surname: { value: "DOE", confidence: 95, sourceText: "SURNAME DOE" },
      forenames: { value: "JOHN", confidence: 95, sourceText: "FORENAMES JOHN" },
      dateOfBirth: { value: null, confidence: 0, sourceText: "" },
      countryOfBirth: { value: "SOUTH AFRICA", confidence: 98, sourceText: "COUNTRY OF BIRTH SOUTH AFRICA" },
      citizenship: { value: "SA CITIZEN", confidence: 98, sourceText: "SA CITIZEN" },
      dateIssued: { value: "2011-08-23", confidence: 90, sourceText: "DATE ISSUED 2011-08-23" },
      issueNumber: { value: null, confidence: 0, sourceText: "" },
      gender: { value: "MALE", confidence: 98, sourceText: "SEX MALE" },
    });

    expect(verification.passed).toBe(false);
    expect(verification.flags).toContain("MISSING_ID_NUMBER");
    expect(verification.flags).toContain("MISSING_DATE_OF_BIRTH");
  });
});
