import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { buildContractorProfileIntelligence } from "@/lib/contractors/contractorProfileIntelligence";
import { fillTemplateWithIntelligence } from "@/lib/empirePdf/intelligentFillEngine";
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
  engine?: {
    averageConfidence: number;
    renderedFieldCount: number;
  };
};

export type TenderFillError = {
  ok: false;
  error: string;
  warnings: string[];
  fieldMapUsed: Record<string, string>;
};

export type TenderFillResult = TenderFillSuccess | TenderFillError;

function safeGet(value: any, fallback: string = "") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return value;
}

function resolveTemplatePath(templateKey: SbdFormKey): string {
  return path.join(
    process.cwd(),
    "src/lib/pdfs/templates/tender-packs",
    `${templateKey}.pdf`
  );
}

function loadTemplateBytes(templateKey: SbdFormKey): { templateBytes: Buffer; templatePath: string } {
  const templatePath = resolveTemplatePath(templateKey);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found for key: ${templateKey}`);
  }

  const templateBytes = fs.readFileSync(templatePath);
  return { templateBytes, templatePath };
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
    companyName: safeGet(profile.companyName),
    regNumber: safeGet(profile.regNumber),
    vatNumber: safeGet(profile.vatNumber),
    taxPin: safeGet(profile.taxPin),
    cidb: safeGet(profile.cidb),
    csdNumber: safeGet(profile.csdNumber),
    bankingDetails: safeGet(profile.bankingDetails),
    directors: safeGet(profile.directors),
    address: safeGet(profile.address),
    contactPerson: safeGet(profile.contactPerson),
    email: safeGet(profile.email),
    phone: safeGet(profile.phone),
    bbbeeLevel: safeGet(profile.bbbeeLevel),
    bbbeeStatus: safeGet(profile.bbbeeStatus),
    country: safeGet(profile.country),
    postalAddress: safeGet(profile.postalAddress),
    streetAddress: safeGet(profile.streetAddress),
    directorName: safeGet(profile.directorName),
    signatoryRole: safeGet(profile.signatoryRole),
    businessType: safeGet(profile.businessType),
  };
}

function buildMappedFieldMap(profile: CompanyProfile, mapping: TemplateFieldMap): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [pdfFieldName, profileKey] of Object.entries(mapping)) {
    const value = profileKey ? safeGet(profile[profileKey]) : "";
    result[pdfFieldName] = typeof value === "string" ? value : safeGet(value);
  }

  return result;
}

function logMissingMappedFields(templateKey: SbdFormKey, mapping: TemplateFieldMap | undefined, profile: CompanyProfile) {
  if (!mapping) {
    return;
  }

  for (const [, profileKey] of Object.entries(mapping)) {
    if (!profileKey) {
      continue;
    }

    if (!safeGet(profile[profileKey])) {
      console.warn(`Missing field: ${String(profileKey)}`);
      console.warn(
        `Autofill fallback engaged for template '${templateKey}' because profile field '${String(profileKey)}' is empty`
      );
    }
  }
}

function getRequiredMissingWarnings(templateKey: SbdFormKey, profile: CompanyProfile): string[] {
  const required = SBD_SCHEMA[templateKey]?.requiredFields ?? [];
  return required
    .filter((field) => !safeGet(profile[field as SbdFieldKey]))
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

    const value = safeGet(fieldMapUsed[overlayFieldName], safeGet(fallbackFieldMap[overlayField.profileKey]));

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
  const mappedFieldMap = registryEntry.fieldMap ? buildMappedFieldMap(profile, registryEntry.fieldMap) : {};
  const fieldMapUsed = {
    ...fallbackFieldMap,
    ...mappedFieldMap,
  };
  const warnings = getRequiredMissingWarnings(templateKey, profile);
  logMissingMappedFields(templateKey, registryEntry.fieldMap, profile);
  const pdfData = {
    templateKey,
    contractorId: profile.contractorId,
    outputMode,
    fieldMapUsed,
    fallbackFieldMap,
  };
  console.log("PDF Input:", pdfData);

  const requiredDiagnosticFields = {
    companyName: fallbackFieldMap.companyName,
    vatNumber: fallbackFieldMap.vatNumber,
    taxPin: fallbackFieldMap.taxPin,
    csdNumber: fallbackFieldMap.csdNumber,
    telephone: fallbackFieldMap.phone,
    email: fallbackFieldMap.email,
  };

  for (const [fieldName, value] of Object.entries(requiredDiagnosticFields)) {
    if (!safeGet(value)) {
      console.warn("Missing field:", fieldName);
    }
  }

  let templateBytes: Buffer;
  let templatePath = "";

  try {
    const loadedTemplate = loadTemplateBytes(templateKey);
    templateBytes = loadedTemplate.templateBytes;
    templatePath = loadedTemplate.templatePath;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Template file not found for key: ${templateKey}`,
      warnings,
      fieldMapUsed,
    };
  }

  try {
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    const fields = form.getFields();
    console.log("PDF Field Diagnostics:", {
      templateKey,
      fieldCount: fields.length,
      fieldNames: fields.map((field) => field.getName()),
      hasOverlayMap: Boolean(registryEntry.overlayMap),
      hasIntelligentTemplate: Boolean(registryEntry.intelligentTemplate),
    });
    if (fields.length > 0) {
      for (const field of fields) {
        const name = field.getName();
        const value = safeGet(fieldMapUsed[name], safeGet(fallbackFieldMap[name]));
        if (!(name in fieldMapUsed) && !(name in fallbackFieldMap)) {
          console.warn(`No autofill mapping resolved for PDF field '${name}' on template '${templateKey}'`);
        }
        try {
          if ("setText" in field && typeof (field as { setText?: unknown }).setText === "function") {
            (field as { setText: (v: string) => void }).setText(value);
          }
        } catch {
          warnings.push(`Unable to set field '${name}'`);
          console.warn(`Unable to set field '${name}' on template '${templateKey}'`);
        }
      }
    } else if (registryEntry.intelligentTemplate || registryEntry.overlayMap) {
      let filledPdfBuffer: Buffer | null = null;
      let engine: TenderFillSuccess["engine"];

      if (registryEntry.intelligentTemplate) {
        try {
          const intelligentResult = await fillTemplateWithIntelligence({
            templateKey,
            templateBytes,
            profile,
            debug: outputMode === "preview" || process.env.EMPIREPDF_DEBUG === "1",
          });

          filledPdfBuffer = Buffer.from(intelligentResult.pdfBytes);
          warnings.push(...intelligentResult.result.warnings);
          engine = {
            averageConfidence: intelligentResult.result.averageConfidence,
            renderedFieldCount: intelligentResult.result.renderedFieldCount,
          };

          console.info("EmpirePDF intelligent fill summary", {
            templateKey,
            averageConfidence: intelligentResult.result.averageConfidence,
            renderedFieldCount: intelligentResult.result.renderedFieldCount,
            debugFields: intelligentResult.result.debugFields,
          });

          const profileIntelligence = buildContractorProfileIntelligence({
            contractorId: profile.contractorId,
            profile,
            rendererFields: intelligentResult.result.debugFields,
          });

          console.info("[CONTRACTOR_PROFILE_INTELLIGENCE]", {
            stage: "contractor_profile_intelligence_generated",
            mode: "renderer_aware",
            contractorId: profile.contractorId,
            templateKey,
            overallCompleteness: profileIntelligence.overallCompleteness,
            criticalGapCount: profileIntelligence.missingCriticalFields.length,
            rendererHealth: profileIntelligence.rendererHealth,
            readinessImpact: profileIntelligence.readinessImpact,
          });
        } catch (error) {
          warnings.push(
            `Intelligent fill failed for '${templateKey}', reverting to overlay fallback: ${
              error instanceof Error ? error.message : "unknown error"
            }`
          );
        }
      }

      if (!filledPdfBuffer && registryEntry.overlayMap) {
        await drawOverlayFields({
          pdfDoc,
          overlayMap: registryEntry.overlayMap,
          fieldMapUsed,
          fallbackFieldMap,
          warnings,
        });

        filledPdfBuffer = Buffer.from(await pdfDoc.save());
      }

      if (filledPdfBuffer) {
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
          engine,
        };
      }
    } else {
      warnings.push(`SBD data breakpoint: no AcroForm fields found for '${templateKey}' and no overlay mapping is configured`);
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
      engine: undefined,
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
