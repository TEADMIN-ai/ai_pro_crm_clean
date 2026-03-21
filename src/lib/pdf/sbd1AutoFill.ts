import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export type ContractorData = {
  companyName: string;
  postalAddress: string;
  streetAddress: string;
  telephone: string;
  cellphone: string;
  email: string;
  vatNumber: string;
  taxPin: string;
  csdNumber?: string;
  telNumber?: string;
  cellNumber?: string;
};

type ResolvedSbd1FieldKey =
  | "companyName"
  | "postalAddress"
  | "streetAddress"
  | "telephoneCode"
  | "telephoneNumber"
  | "cellphone"
  | "email"
  | "vatNumber"
  | "taxPin"
  | "csdNumber";

type Sbd1SourceKey =
  | "companyName"
  | "postalAddress"
  | "streetAddress"
  | "telephone"
  | "telNumber"
  | "cellphone"
  | "cellNumber"
  | "email"
  | "vatNumber"
  | "taxPin"
  | "csdNumber";

type FieldPlacement = {
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  x: number;
  y: number;
  maxWidth: number;
  size?: number;
};

type Sbd1ResolvedField = {
  value: string;
  sources: Sbd1SourceKey[];
  isPlaceholder?: boolean;
};

type RequiredSbd1FieldKey =
  | "bidder_name"
  | "address"
  | "email"
  | "telephone"
  | "tax_pin"
  | "csd_number";

export type SBD1ValidationResult = {
  isValid: boolean;
  missingFields: RequiredSbd1FieldKey[];
  missingLabels: string[];
};

export type GenerateSBD1Result = {
  pdfBytes: Uint8Array;
  validation: SBD1ValidationResult;
};

const SBD1_TEMPLATE_PATH = "/templates/SBD1.pdf";

const FIELD_FONT_SIZE = 10;
const WARNING_FONT_SIZE = 8;
const WARNING_START_X = 48;
const WARNING_START_Y = 48;
const WARNING_LINE_HEIGHT = 10;
const WARNING_COLOR = rgb(1, 0, 0);
const CONTROLLED_OVERLAY_FONT_SIZE = 9;
const CONTROLLED_OVERLAY_CHECKBOX_SIZE = 10;
const CONTROLLED_OVERLAY_MARK = "X";

const COMPLIANCE_WARNING_FIELDS = [
  { key: "vatNumber", label: "VAT Number" },
  { key: "taxPin", label: "Tax Pin" },
  { key: "csdNumber", label: "CSD Number" },
] as const;

const FIELD_POSITIONS = {
  bidder_name: { x: 185, y: 505, maxWidth: 280 },
  address: { x: 185, y: 475, maxWidth: 280 },
  tax_pin: { x: 330, y: 355, maxWidth: 100 },
  csd_number: { x: 455, y: 335, maxWidth: 110 },
  bbee_check_yes: { x: 420, y: 215 },
  bbee_check_no: { x: 465, y: 215 },
} as const;

const FIELD_POSITIONS_EXTENDED = {
  bidder_name: { x: 185, y: 505, maxWidth: 280 },
  postal_address: { x: 185, y: 480, maxWidth: 280 },
  street_address: { x: 185, y: 460, maxWidth: 280 },
  telephone: { x: 300, y: 440, maxWidth: 165 },
  cellphone: { x: 185, y: 420, maxWidth: 280 },
  email: { x: 185, y: 400, maxWidth: 280 },
  vat_number: { x: 185, y: 380, maxWidth: 280 },
  tax_pin: { x: 330, y: 355, maxWidth: 100 },
  csd_number: { x: 455, y: 335, maxWidth: 110 },
} as const;

const SIGNATURE_POSITIONS = {
  signature: { x: 180, y: 260, maxWidth: 120 },
  name: { x: 180, y: 230, maxWidth: 220 },
  capacity: { x: 180, y: 210, maxWidth: 180 },
  date: { x: 180, y: 190, maxWidth: 120 },
} as const;

const DECLARATION_SIGNATORY = {
  name: "Chadwin Wesley Karanie",
  capacity: "Director",
  signature: "C.W.K",
} as const;

const FIELD_LABELS: Record<RequiredSbd1FieldKey, string> = {
  bidder_name: "Name of Bidder",
  address: "Address",
  email: "Email Address",
  telephone: "Telephone Number",
  tax_pin: "Tax Compliance PIN",
  csd_number: "CSD Number",
};

const SBD1_PLACEHOLDER_TEXT = "N/A";

const SBD1_COORDINATE_MAP: Record<ResolvedSbd1FieldKey, FieldPlacement> = {
  companyName: {
    boxX: 144.02,
    boxY: 426.67,
    boxWidth: 423.07,
    boxHeight: 14.52,
    x: 148,
    y: 431.2,
    maxWidth: 415.5,
    size: FIELD_FONT_SIZE,
  },
  postalAddress: {
    boxX: 144.02,
    boxY: 409.15,
    boxWidth: 423.07,
    boxHeight: 14.52,
    x: 148,
    y: 413.7,
    maxWidth: 415.5,
    size: FIELD_FONT_SIZE,
  },
  streetAddress: {
    boxX: 144.02,
    boxY: 391.63,
    boxWidth: 423.07,
    boxHeight: 14.64,
    x: 148,
    y: 396.2,
    maxWidth: 415.5,
    size: FIELD_FONT_SIZE,
  },
  telephoneCode: {
    boxX: 144.02,
    boxY: 376.63,
    boxWidth: 72.74,
    boxHeight: 14.52,
    x: 158,
    y: 380.7,
    maxWidth: 66,
    size: FIELD_FONT_SIZE,
  },
  telephoneNumber: {
    boxX: 227.57,
    boxY: 376.63,
    boxWidth: 214.94,
    boxHeight: 14.52,
    x: 239,
    y: 380.7,
    maxWidth: 207,
    size: FIELD_FONT_SIZE,
  },
  cellphone: {
    boxX: 144.02,
    boxY: 332.45,
    boxWidth: 423.07,
    boxHeight: 14.52,
    x: 148,
    y: 337,
    maxWidth: 415.5,
    size: FIELD_FONT_SIZE,
  },
  email: {
    boxX: 144.02,
    boxY: 285.41,
    boxWidth: 423.07,
    boxHeight: 14.52,
    x: 149,
    y: 290,
    maxWidth: 415.5,
    size: FIELD_FONT_SIZE,
  },
  vatNumber: {
    boxX: 144.02,
    boxY: 241.25,
    boxWidth: 423.07,
    boxHeight: 43.68,
    x: 148,
    y: 258,
    maxWidth: 415.5,
    size: FIELD_FONT_SIZE,
  },
  taxPin: {
    boxX: 227.57,
    boxY: 182.54,
    boxWidth: 70.08,
    boxHeight: 14.54,
    x: 238,
    y: 186.8,
    maxWidth: 62,
    size: FIELD_FONT_SIZE,
  },
  csdNumber: {
    boxX: 428.71,
    boxY: 182.54,
    boxWidth: 138.38,
    boxHeight: 14.54,
    x: 436,
    y: 185.8,
    maxWidth: 131,
    size: FIELD_FONT_SIZE,
  },
};

async function loadTemplateSafe(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`Template not found: ${url}`);
      return null;
    }

    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error("Template load failed:", err);
    return null;
  }
}

async function createSBD1Document(templateBytes?: Uint8Array | null): Promise<PDFDocument> {
  let pdfDoc: PDFDocument;

  if (!templateBytes) {
    console.warn("Using fallback blank PDF template");
    console.warn("Missing template. Place SBD1.pdf or SBD4.pdf in /public/templates/");

    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]);
  } else {
    pdfDoc = await PDFDocument.load(templateBytes);
  }

  return pdfDoc;
}

function getRequiredSBD1Fields(data: ContractorData): Record<RequiredSbd1FieldKey, string> {
  return {
    bidder_name: data.companyName,
    address: data.streetAddress || data.postalAddress,
    email: data.email,
    telephone: data.telNumber ?? data.telephone,
    tax_pin: data.taxPin,
    csd_number: data.csdNumber ?? "",
  };
}

function pickFirstPopulatedField(
  data: ContractorData,
  sources: readonly Sbd1SourceKey[],
  fallbackValue = ""
): Sbd1ResolvedField {
  for (const source of sources) {
    const value = cleanText(data[source]);
    if (value) {
      return {
        value,
        sources: [source],
      };
    }
  }

  return {
    value: fallbackValue,
    sources: [...sources],
    isPlaceholder: Boolean(cleanText(fallbackValue)),
  };
}

function resolveSBD1Fields(data: ContractorData): Record<ResolvedSbd1FieldKey, Sbd1ResolvedField> {
  const addressFallback = pickFirstPopulatedField(data, ["streetAddress", "postalAddress"], SBD1_PLACEHOLDER_TEXT);
  const postalAddress = pickFirstPopulatedField(
    data,
    ["postalAddress", "streetAddress"],
    addressFallback.value || SBD1_PLACEHOLDER_TEXT
  );
  const streetAddress = pickFirstPopulatedField(
    data,
    ["streetAddress", "postalAddress"],
    addressFallback.value || SBD1_PLACEHOLDER_TEXT
  );
  const telephoneValue = pickFirstPopulatedField(
    data,
    ["telNumber", "telephone", "cellNumber", "cellphone"],
    SBD1_PLACEHOLDER_TEXT
  );
  const cellphoneValue = pickFirstPopulatedField(
    data,
    ["cellNumber", "cellphone", "telNumber", "telephone"],
    telephoneValue.value || SBD1_PLACEHOLDER_TEXT
  );
  const telephoneParts = splitPhoneNumber(telephoneValue.value);
  const telephoneCodeValue = cleanText(telephoneParts.code) || cleanText(telephoneValue.value) || SBD1_PLACEHOLDER_TEXT;
  const telephoneNumberValue =
    cleanText(telephoneParts.number) || cleanText(telephoneValue.value) || SBD1_PLACEHOLDER_TEXT;

  return {
    companyName: pickFirstPopulatedField(data, ["companyName"], SBD1_PLACEHOLDER_TEXT),
    postalAddress,
    streetAddress,
    telephoneCode: {
      value: telephoneCodeValue,
      sources: [...telephoneValue.sources],
      isPlaceholder: telephoneCodeValue === SBD1_PLACEHOLDER_TEXT,
    },
    telephoneNumber: {
      value: telephoneNumberValue,
      sources: [...telephoneValue.sources],
      isPlaceholder: telephoneNumberValue === SBD1_PLACEHOLDER_TEXT,
    },
    cellphone: {
      value: cellphoneValue.value || SBD1_PLACEHOLDER_TEXT,
      sources: [...cellphoneValue.sources],
      isPlaceholder: (cellphoneValue.value || SBD1_PLACEHOLDER_TEXT) === SBD1_PLACEHOLDER_TEXT,
    },
    email: pickFirstPopulatedField(data, ["email"], SBD1_PLACEHOLDER_TEXT),
    vatNumber: pickFirstPopulatedField(data, ["vatNumber"], SBD1_PLACEHOLDER_TEXT),
    taxPin: pickFirstPopulatedField(data, ["taxPin"], SBD1_PLACEHOLDER_TEXT),
    csdNumber: pickFirstPopulatedField(data, ["csdNumber"], SBD1_PLACEHOLDER_TEXT),
  };
}

function logSBD1FieldAudit(
  data: ContractorData,
  resolvedFields: Record<ResolvedSbd1FieldKey, Sbd1ResolvedField>,
  validation: SBD1ValidationResult
) {
  const inputSnapshot = {
    companyName: cleanText(data.companyName),
    postalAddress: cleanText(data.postalAddress),
    streetAddress: cleanText(data.streetAddress),
    telephone: cleanText(data.telephone),
    telNumber: cleanText(data.telNumber),
    cellphone: cleanText(data.cellphone),
    cellNumber: cleanText(data.cellNumber),
    email: cleanText(data.email),
    vatNumber: cleanText(data.vatNumber),
    taxPin: cleanText(data.taxPin),
    csdNumber: cleanText(data.csdNumber),
  };

  const mappingTrace = Object.fromEntries(
    (Object.entries(resolvedFields) as Array<[ResolvedSbd1FieldKey, Sbd1ResolvedField]>).map(([key, resolved]) => [
      key,
      {
        value: resolved.value,
        sources: resolved.sources,
        placeholder: resolved.isPlaceholder === true,
      },
    ])
  );

  console.info("SBD1 input snapshot:", inputSnapshot);
  console.info("SBD1 field mapping trace:", mappingTrace);

  const missingResolvedKeys = (Object.entries(resolvedFields) as Array<[ResolvedSbd1FieldKey, Sbd1ResolvedField]>)
    .filter(([, resolved]) => !cleanText(resolved.value) || resolved.isPlaceholder)
    .map(([key]) => key);

  if (missingResolvedKeys.length > 0) {
    console.warn("SBD1 autofill used placeholders for keys:", missingResolvedKeys);
  }

  if (!validation.isValid) {
    console.warn("SBD1 validation missing keys:", validation.missingFields);
  }
}

function cleanText(value: any): string {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "")
    .replace(/[^a-zA-Z0-9\s:%.,-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fitSingleLineText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return "";
  }

  if (font.widthOfTextAtSize(cleaned, size) <= maxWidth) {
    return cleaned;
  }

  let fitted = cleaned;
  while (fitted.length > 0 && font.widthOfTextAtSize(`${fitted}...`, size) > maxWidth) {
    fitted = fitted.slice(0, -1).trimEnd();
  }

  return fitted ? `${fitted}...` : "";
}

function splitPhoneNumber(value: string): { code: string; number: string } {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return { code: "", number: "" };
  }

  const compact = cleaned.replace(/\s+/g, " ").trim();
  const explicitParts = compact.split(/[\s/()-]+/).filter(Boolean);

  if (explicitParts.length >= 2) {
    return {
      code: explicitParts[0] ?? "",
      number: explicitParts.slice(1).join(" "),
    };
  }

  const digitsOnly = compact.replace(/\D/g, "");
  if (digitsOnly.length >= 7) {
    const codeLength =
      digitsOnly.startsWith("27") && digitsOnly.length >= 11 ? 2 : digitsOnly.startsWith("0") ? 3 : 4;

    return {
      code: digitsOnly.slice(0, codeLength),
      number: digitsOnly.slice(codeLength),
    };
  }

  return { code: "", number: compact };
}

function drawField(
  page: PDFPage,
  font: PDFFont,
  text: string,
  placement: FieldPlacement
) {
  const size = placement.size ?? FIELD_FONT_SIZE;
  const fittedText = fitSingleLineText(font, text, size, placement.maxWidth);

  if (!fittedText) {
    return;
  }

  page.drawRectangle({
    x: placement.boxX,
    y: placement.boxY,
    width: placement.boxWidth,
    height: placement.boxHeight,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  page.drawText(fittedText, {
    x: placement.x,
    y: placement.y,
    size,
    maxWidth: placement.maxWidth,
    font,
    color: rgb(0, 0, 0),
  });
}

function getMissingComplianceFieldLabels(data: ContractorData): string[] {
  return COMPLIANCE_WARNING_FIELDS.filter(({ key }) => !cleanText(data[key])).map(({ label }) => label);
}

export function validateSBD1(data: ContractorData): SBD1ValidationResult {
  const requiredFields = getRequiredSBD1Fields(data);
  const missing: RequiredSbd1FieldKey[] = [];

  (Object.entries(requiredFields) as Array<[RequiredSbd1FieldKey, string]>).forEach(([key, value]) => {
    if (!cleanText(value)) {
      missing.push(key);
    }
  });

  return {
    isValid: missing.length === 0,
    missingFields: missing,
    missingLabels: missing.map((field) => FIELD_LABELS[field] || field),
  };
}

function drawComplianceWarning(page: PDFPage, font: PDFFont, missingLabels: string[]) {
  if (missingLabels.length === 0) {
    return;
  }

  page.drawText("WARNING: Missing required compliance fields:", {
    x: WARNING_START_X,
    y: WARNING_START_Y,
    size: WARNING_FONT_SIZE,
    font,
    color: WARNING_COLOR,
  });

  missingLabels.forEach((label, index) => {
    page.drawText(`* ${label}`, {
      x: WARNING_START_X,
      y: WARNING_START_Y - WARNING_LINE_HEIGHT * (index + 1),
      size: WARNING_FONT_SIZE,
      font,
      color: WARNING_COLOR,
    });
  });
}

function drawControlledFieldOverlay(page: PDFPage, font: PDFFont, data: ContractorData) {
  const overlayAddress = cleanText(data.streetAddress || data.postalAddress);
  const bidderName = fitSingleLineText(
    font,
    data.companyName,
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS.bidder_name.maxWidth
  );
  const address = fitSingleLineText(
    font,
    overlayAddress,
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS.address.maxWidth
  );
  const taxPin = fitSingleLineText(
    font,
    data.taxPin,
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS.tax_pin.maxWidth
  );
  const csdNumber = fitSingleLineText(
    font,
    data.csdNumber ?? "",
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS.csd_number.maxWidth
  );
  const postalAddress = fitSingleLineText(
    font,
    data.postalAddress,
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS_EXTENDED.postal_address.maxWidth
  );
  const streetAddress = fitSingleLineText(
    font,
    data.streetAddress,
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS_EXTENDED.street_address.maxWidth
  );
  const telephone = fitSingleLineText(
    font,
    data.telNumber ?? data.telephone,
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS_EXTENDED.telephone.maxWidth
  );
  const cellphone = fitSingleLineText(
    font,
    data.cellNumber ?? data.cellphone,
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS_EXTENDED.cellphone.maxWidth
  );
  const email = fitSingleLineText(
    font,
    data.email,
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS_EXTENDED.email.maxWidth
  );
  const vatNumber = fitSingleLineText(
    font,
    data.vatNumber,
    CONTROLLED_OVERLAY_FONT_SIZE,
    FIELD_POSITIONS_EXTENDED.vat_number.maxWidth
  );

  if (bidderName) {
    page.drawText(bidderName, {
      x: FIELD_POSITIONS.bidder_name.x,
      y: FIELD_POSITIONS.bidder_name.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS.bidder_name.maxWidth,
    });
  }

  if (address) {
    page.drawText(address, {
      x: FIELD_POSITIONS.address.x,
      y: FIELD_POSITIONS.address.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS.address.maxWidth,
    });
  }

  if (postalAddress) {
    page.drawText(postalAddress, {
      x: FIELD_POSITIONS_EXTENDED.postal_address.x,
      y: FIELD_POSITIONS_EXTENDED.postal_address.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS_EXTENDED.postal_address.maxWidth,
    });
  }

  if (streetAddress) {
    page.drawText(streetAddress, {
      x: FIELD_POSITIONS_EXTENDED.street_address.x,
      y: FIELD_POSITIONS_EXTENDED.street_address.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS_EXTENDED.street_address.maxWidth,
    });
  }

  if (telephone) {
    page.drawText(telephone, {
      x: FIELD_POSITIONS_EXTENDED.telephone.x,
      y: FIELD_POSITIONS_EXTENDED.telephone.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS_EXTENDED.telephone.maxWidth,
    });
  }

  if (cellphone) {
    page.drawText(cellphone, {
      x: FIELD_POSITIONS_EXTENDED.cellphone.x,
      y: FIELD_POSITIONS_EXTENDED.cellphone.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS_EXTENDED.cellphone.maxWidth,
    });
  }

  if (email) {
    page.drawText(email, {
      x: FIELD_POSITIONS_EXTENDED.email.x,
      y: FIELD_POSITIONS_EXTENDED.email.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS_EXTENDED.email.maxWidth,
    });
  }

  if (vatNumber) {
    page.drawText(vatNumber, {
      x: FIELD_POSITIONS_EXTENDED.vat_number.x,
      y: FIELD_POSITIONS_EXTENDED.vat_number.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS_EXTENDED.vat_number.maxWidth,
    });
  }

  if (taxPin) {
    page.drawText(taxPin, {
      x: FIELD_POSITIONS.tax_pin.x,
      y: FIELD_POSITIONS.tax_pin.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS.tax_pin.maxWidth,
    });
  }

  if (csdNumber) {
    page.drawText(csdNumber, {
      x: FIELD_POSITIONS.csd_number.x,
      y: FIELD_POSITIONS.csd_number.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: FIELD_POSITIONS.csd_number.maxWidth,
    });
  }

  page.drawText(CONTROLLED_OVERLAY_MARK, {
    x: FIELD_POSITIONS.bbee_check_yes.x,
    y: FIELD_POSITIONS.bbee_check_yes.y,
    size: CONTROLLED_OVERLAY_CHECKBOX_SIZE,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawDeclarationOverlay(lastPage: PDFPage, font: PDFFont) {
  const signatoryName = fitSingleLineText(
    font,
    DECLARATION_SIGNATORY.name,
    CONTROLLED_OVERLAY_FONT_SIZE,
    SIGNATURE_POSITIONS.name.maxWidth
  );
  const signatoryCapacity = fitSingleLineText(
    font,
    DECLARATION_SIGNATORY.capacity,
    CONTROLLED_OVERLAY_FONT_SIZE,
    SIGNATURE_POSITIONS.capacity.maxWidth
  );
  const signature = fitSingleLineText(
    font,
    DECLARATION_SIGNATORY.signature,
    CONTROLLED_OVERLAY_CHECKBOX_SIZE,
    SIGNATURE_POSITIONS.signature.maxWidth
  );
  const today = new Date().toLocaleDateString("en-ZA");
  const declarationDate = fitSingleLineText(
    font,
    today,
    CONTROLLED_OVERLAY_FONT_SIZE,
    SIGNATURE_POSITIONS.date.maxWidth
  );

  if (signatoryName) {
    lastPage.drawText(signatoryName, {
      x: SIGNATURE_POSITIONS.name.x,
      y: SIGNATURE_POSITIONS.name.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: SIGNATURE_POSITIONS.name.maxWidth,
    });
  }

  if (signatoryCapacity) {
    lastPage.drawText(signatoryCapacity, {
      x: SIGNATURE_POSITIONS.capacity.x,
      y: SIGNATURE_POSITIONS.capacity.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: SIGNATURE_POSITIONS.capacity.maxWidth,
    });
  }

  if (declarationDate) {
    lastPage.drawText(declarationDate, {
      x: SIGNATURE_POSITIONS.date.x,
      y: SIGNATURE_POSITIONS.date.y,
      size: CONTROLLED_OVERLAY_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: SIGNATURE_POSITIONS.date.maxWidth,
    });
  }

  if (signature) {
    lastPage.drawText(signature, {
      x: SIGNATURE_POSITIONS.signature.x,
      y: SIGNATURE_POSITIONS.signature.y,
      size: CONTROLLED_OVERLAY_CHECKBOX_SIZE,
      font,
      color: rgb(0, 0, 0),
      maxWidth: SIGNATURE_POSITIONS.signature.maxWidth,
    });
  }
}

export async function loadSBD1Template(): Promise<Uint8Array> {
  const templateBytes = await loadTemplateSafe(SBD1_TEMPLATE_PATH);

  if (templateBytes) {
    return templateBytes;
  }

  const pdfDoc = await createSBD1Document(null);
  return pdfDoc.save();
}

export async function generateSBD1(
  templateBytes: Uint8Array | null | undefined,
  data: ContractorData
): Promise<Uint8Array> {
  const { pdfBytes } = await generateSBD1WithValidation(templateBytes, data);

  return pdfBytes;
}

export async function generateSBD1WithValidation(
  templateBytes: Uint8Array | null | undefined,
  data: ContractorData
): Promise<GenerateSBD1Result> {
  const validation = validateSBD1(data);

  if (!validation.isValid) {
    console.warn("Missing required SBD1 fields:", validation.missingFields);
  }

  const pdfDoc = await createSBD1Document(templateBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  fields.forEach((field) => {
    console.log("FIELD NAME:", field.getName());
  });

  const pages = pdfDoc.getPages();
  console.log("Total pages:", pages.length);
  const firstPage = pages[0];
  const lastPage = pages[pages.length - 1];

  if (!firstPage || !lastPage) {
    throw new Error("SBD1 template does not contain a first page");
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const resolvedFields = resolveSBD1Fields(data);
  logSBD1FieldAudit(data, resolvedFields, validation);

  const overlayData: ContractorData = {
    ...data,
    companyName: resolvedFields.companyName.value,
    postalAddress: resolvedFields.postalAddress.value,
    streetAddress: resolvedFields.streetAddress.value,
    telephone: resolvedFields.telephoneNumber.value,
    telNumber: [resolvedFields.telephoneCode.value, resolvedFields.telephoneNumber.value]
      .filter((part) => cleanText(part) && part !== SBD1_PLACEHOLDER_TEXT)
      .join(" "),
    cellphone: resolvedFields.cellphone.value,
    cellNumber: resolvedFields.cellphone.value,
    email: resolvedFields.email.value,
    vatNumber: resolvedFields.vatNumber.value,
    taxPin: resolvedFields.taxPin.value,
    csdNumber: resolvedFields.csdNumber.value,
  };

  drawControlledFieldOverlay(firstPage, font, overlayData);
  drawDeclarationOverlay(lastPage, font);

  for (const [fieldKey, placement] of Object.entries(SBD1_COORDINATE_MAP) as Array<
    [ResolvedSbd1FieldKey, FieldPlacement]
  >) {
    drawField(firstPage, font, resolvedFields[fieldKey].value, placement);
  }

  drawComplianceWarning(firstPage, font, getMissingComplianceFieldLabels(data));

  const pdfBytes = await pdfDoc.save();

  return {
    pdfBytes,
    validation,
  };
}

export function downloadSBD1(pdfBytes: Uint8Array) {
  const normalizedBytes = new Uint8Array(pdfBytes.byteLength);
  normalizedBytes.set(pdfBytes);

  const blob = new Blob([normalizedBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "SBD1_Filled.pdf";
  anchor.click();

  URL.revokeObjectURL(url);
}
