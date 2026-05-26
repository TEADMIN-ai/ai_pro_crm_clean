import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { fillTemplateWithIntelligence } from "@/lib/empirePdf/intelligentFillEngine";
import { SBD4_FIELD_MAP, SBD4_FIELDS } from "@/lib/pdf/maps/SBD4";
import { applySignature } from "@/lib/empirePdf/signatureOverlay";

type DealInput = {
  id: string;
  title: string;
  value: number | null;
  readinessScore: number;
  missingDocs: string[];
  riskLevel: string;
  suggestions: string[];
};

type ContractorInput = {
  id: string;
  companyName: string;
  registrationNumber: string | null;
  bbbeeStatus: string | null;
  contactPerson?: string | null;
  directorName?: string | null;
};

type FieldPlacement = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  textX?: number;
  textY?: number;
  size?: number;
};

const FIELD_MAP: Record<
  "companyName" | "directorName" | "relationshipDeclaration" | "date",
  FieldPlacement
> = {
  companyName: {
    page: 0,
    x: SBD4_FIELDS.companyName.x - 4,
    y: SBD4_FIELDS.companyName.y - 3,
    width: 320,
    height: 14,
    textX: SBD4_FIELDS.companyName.x,
    textY: SBD4_FIELDS.companyName.y,
    size: 9,
  },
  directorName: {
    page: 0,
    x: SBD4_FIELDS.directorName.x - 4,
    y: SBD4_FIELDS.directorName.y - 3,
    width: 300,
    height: 14,
    textX: SBD4_FIELDS.directorName.x,
    textY: SBD4_FIELDS.directorName.y,
    size: 9,
  },
  relationshipDeclaration: {
    page: 1,
    x: SBD4_FIELD_MAP.answer.x - 8,
    y: SBD4_FIELD_MAP.answer.y - 3,
    width: 78,
    height: 14,
    textX: SBD4_FIELD_MAP.answer.x - 2,
    textY: SBD4_FIELD_MAP.answer.y,
    size: 9,
  },
  date: {
    page: 2,
    x: SBD4_FIELD_MAP.date.x - 4,
    y: SBD4_FIELD_MAP.date.y - 3,
    width: SBD4_FIELD_MAP.date.width,
    height: 14,
    textX: SBD4_FIELD_MAP.date.x,
    textY: SBD4_FIELD_MAP.date.y,
    size: 10,
  },
};

function clean(value: unknown, fallback = "N/A"): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function overlayField(
  page: PDFPage,
  font: PDFFont,
  value: string,
  placement: FieldPlacement,
) {
  page.drawRectangle({
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    color: rgb(1, 1, 1),
  });

  page.drawText(value, {
    x: placement.textX ?? placement.x + 2,
    y: placement.textY ?? placement.y + 2,
    size: placement.size ?? 10,
    font,
    color: rgb(0, 0, 0),
  });
}

export async function fillSbd4(
  contractor: ContractorInput,
  deal: DealInput,
): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), "public", "templates", "SBD4.pdf");
  const templateBytes = await readFile(templatePath);

  try {
    const intelligentResult = await fillTemplateWithIntelligence({
      templateKey: "sbd4",
      templateBytes,
      profile: {
        contractorId: contractor.id,
        companyName: clean(contractor.companyName, contractor.id),
        regNumber: clean(contractor.registrationNumber, ""),
        vatNumber: "",
        taxPin: "",
        cidb: "",
        csdNumber: "",
        bankingDetails: "",
        directors: clean(contractor.directorName, contractor.contactPerson || contractor.companyName),
        address: "",
        contactPerson: clean(contractor.contactPerson, contractor.companyName),
        email: "",
        phone: "",
        directorName: clean(contractor.directorName, contractor.contactPerson || contractor.companyName),
        signatoryRole: "Authorized Signatory",
        missingFields: [],
        sourceAttribution: {},
      },
      debug: process.env.EMPIREPDF_DEBUG === "1",
    });

    console.info("SBD4 intelligent fill completed", {
      contractorId: contractor.id,
      dealId: deal.id,
      averageConfidence: intelligentResult.result.averageConfidence,
      renderedFieldCount: intelligentResult.result.renderedFieldCount,
      warnings: intelligentResult.result.warnings,
    });

    return intelligentResult.pdfBytes;
  } catch (error) {
    console.warn("SBD4 intelligent fill failed, using legacy overlay fallback", {
      contractorId: contractor.id,
      dealId: deal.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  const existingPdf = await PDFDocument.load(templateBytes);
  const pages = existingPdf.getPages();

  if (pages.length < 3) {
    throw new Error("SBD4 template is missing required pages");
  }

  const font = await existingPdf.embedFont(StandardFonts.Helvetica);
  const currentDate = new Date().toLocaleDateString("en-ZA");

  const values = {
    companyName: clean(contractor.companyName, contractor.id),
    directorName: clean(contractor.directorName, contractor.contactPerson || contractor.companyName),
    relationshipDeclaration: "None",
    date: currentDate,
  };

  overlayField(pages[FIELD_MAP.companyName.page], font, values.companyName, FIELD_MAP.companyName);
  overlayField(pages[FIELD_MAP.directorName.page], font, values.directorName, FIELD_MAP.directorName);
  overlayField(
    pages[FIELD_MAP.relationshipDeclaration.page],
    font,
    values.relationshipDeclaration,
    FIELD_MAP.relationshipDeclaration,
  );
  overlayField(pages[FIELD_MAP.date.page], font, values.date, FIELD_MAP.date);

  applySignature(
    pages[2],
    font,
    clean(contractor.companyName, contractor.id),
    currentDate,
    {
      nameX: SBD4_FIELD_MAP.name.x,
      nameY: SBD4_FIELD_MAP.name.y - 3,
      nameWidth: SBD4_FIELD_MAP.name.width,
      dateX: SBD4_FIELD_MAP.date.x,
      dateY: SBD4_FIELD_MAP.date.y,
      dateWidth: SBD4_FIELD_MAP.date.width,
      maskHeight: 14,
      fontSize: 10,
    },
  );

  void deal;

  return existingPdf.save();
}
