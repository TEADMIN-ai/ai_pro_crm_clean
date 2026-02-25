import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { SBD_SCHEMA, type SbdFieldKey, type SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";
import {
  TEMPLATE_REGISTRY,
  type TemplateFieldMap,
  type TemplateOverlayMap,
} from "@/lib/pdfs/templates/templateRegistry";

export type FillTenderPackParams = {
  templateKey: SbdFormKey;
  profile: CompanyProfile;
  outputMode: "preview" | "final";
};

export type TenderFillSuccess = {
  ok: true;
  filledPdfBuffer: Buffer;
  fieldMapUsed: Record<string, string>;
  warnings: string[];
};

export type TenderFillError = {
  ok: false;
  error: string;
  warnings: string[];
  fieldMapUsed: Record<string, string>;
};

export type TenderFillResult = TenderFillSuccess | TenderFillError;

function resolveTemplatePaths(templateKey: SbdFormKey): string[] {
  const registryEntry = TEMPLATE_REGISTRY[templateKey];
  if (!registryEntry) {
    return [];
  }

  return [
    path.join(process.cwd(), registryEntry.pdfRelativePath),
    path.join(process.cwd(), "templates", "tender-packs", `${templateKey}.pdf`),
  ];
}

async function writeAuditTrail(data: {
  templateKey: SbdFormKey;
  contractorId: string;
  warnings: string[];
  fieldMapUsed: Record<string, string>;
}) {
  const db = getFirebaseAdmin();
  await db.collection("tenderPackAudit").add({
    ...data,
    createdAt: Date.now(),
    event: "autofill",
  });
}

function buildFieldMap(profile: CompanyProfile): Record<string, string> {
  return {
    companyName: profile.companyName,
    regNumber: profile.regNumber,
    vatNumber: profile.vatNumber,
    taxPin: profile.taxPin,
    cidb: profile.cidb,
    csdNumber: profile.csdNumber,
    bankingDetails: profile.bankingDetails,
    directors: profile.directors,
    address: profile.address,
    contactPerson: profile.contactPerson,
    email: profile.email,
    phone: profile.phone,
  };
}

function buildMappedFieldMap(profile: CompanyProfile, mapping: TemplateFieldMap): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [pdfFieldName, profileKey] of Object.entries(mapping)) {
    const value = profileKey ? profile[profileKey] : "";
    result[pdfFieldName] = typeof value === "string" ? value : "";
  }

  return result;
}

function getRequiredMissingWarnings(templateKey: SbdFormKey, profile: CompanyProfile): string[] {
  const required = SBD_SCHEMA[templateKey]?.requiredFields ?? [];
  return required
    .filter((field) => !profile[field as SbdFieldKey])
    .map((field) => `Missing required field for ${templateKey}: ${field}`);
}

async function drawOverlayFields(params: {
  pdfDoc: PDFDocument;
  overlayMap: TemplateOverlayMap;
  fieldMapUsed: Record<string, string>;
  fallbackFieldMap: Record<string, string>;
  warnings: string[];
}) {
  const { pdfDoc, overlayMap, fieldMapUsed, fallbackFieldMap, warnings } = params;
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const [overlayFieldName, overlayField] of Object.entries(overlayMap)) {
    const targetPage = pages[overlayField.page];
    if (!targetPage) {
      warnings.push(
        `Overlay page index '${overlayField.page}' is out of range for field '${overlayFieldName}'`
      );
      continue;
    }

    const value =
      fieldMapUsed[overlayFieldName] ?? fallbackFieldMap[overlayField.profileKey] ?? "";
    if (!value) {
      continue;
    }

    targetPage.drawText(value, {
      x: overlayField.x,
      y: overlayField.y,
      size: overlayField.size ?? 10,
      maxWidth: overlayField.maxWidth,
      lineHeight: overlayField.lineHeight,
      color: rgb(0, 0, 0),
      font,
    });
  }
}

export async function fillTenderPack(params: FillTenderPackParams): Promise<TenderFillResult> {
  const { templateKey, profile, outputMode } = params;

  const registryEntry = TEMPLATE_REGISTRY[templateKey];
  if (!registryEntry) {
    return {
      ok: false,
      error: `Template registry entry not found for key '${templateKey}'`,
      warnings: [],
      fieldMapUsed: {},
    };
  }

  const fallbackFieldMap = buildFieldMap(profile);
  const fieldMapUsed = registryEntry.fieldMap
    ? buildMappedFieldMap(profile, registryEntry.fieldMap)
    : fallbackFieldMap;
  const warnings = getRequiredMissingWarnings(templateKey, profile);

  let templateBytes: Buffer;
  let templatePath = "";
  const candidatePaths = resolveTemplatePaths(templateKey);

  if (candidatePaths.length === 0) {
    return {
      ok: false,
      error: `Template path could not be resolved for key '${templateKey}'`,
      warnings,
      fieldMapUsed,
    };
  }

  try {
    let loaded = false;
    templateBytes = Buffer.alloc(0);

    for (const candidatePath of candidatePaths) {
      try {
        templateBytes = await fs.readFile(candidatePath);
        templatePath = candidatePath;
        loaded = true;
        break;
      } catch {
        // try next candidate
      }
    }

    if (!loaded) {
      throw new Error("template not found in any configured path");
    }
  } catch {
    return {
      ok: false,
      error: `Template file not found for key '${templateKey}' at ${candidatePaths.join(" or ")}`,
      warnings,
      fieldMapUsed,
    };
  }

  try {
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    const fields = form.getFields();
    if (fields.length > 0) {
      for (const field of fields) {
        const name = field.getName();
        const value = fieldMapUsed[name] ?? fallbackFieldMap[name] ?? "";
        try {
          if ("setText" in field && typeof (field as { setText?: unknown }).setText === "function") {
            (field as { setText: (v: string) => void }).setText(value);
          }
        } catch {
          warnings.push(`Unable to set field '${name}'`);
        }
      }
    } else if (registryEntry.overlayMap) {
      await drawOverlayFields({
        pdfDoc,
        overlayMap: registryEntry.overlayMap,
        fieldMapUsed,
        fallbackFieldMap,
        warnings,
      });
    } else {
      warnings.push(`No AcroForm fields found and no overlay mapping configured for '${templateKey}'`);
    }

    const bytes = await pdfDoc.save();
    const filledPdfBuffer = Buffer.from(bytes);

    if (outputMode === "final") {
      await writeAuditTrail({
        templateKey,
        contractorId: profile.contractorId,
        warnings,
        fieldMapUsed,
      });
    }

    return {
      ok: true,
      filledPdfBuffer,
      fieldMapUsed,
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown PDF filling error",
      warnings,
      fieldMapUsed: { ...fieldMapUsed, __templatePath: templatePath },
    };
  }
}
