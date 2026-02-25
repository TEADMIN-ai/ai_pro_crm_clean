import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { SBD_SCHEMA, type SbdFieldKey, type SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";

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

function resolveTemplatePath(templateKey: SbdFormKey): string {
  return path.join(process.cwd(), "templates", "tender-packs", `${templateKey}.pdf`);
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

function getRequiredMissingWarnings(templateKey: SbdFormKey, profile: CompanyProfile): string[] {
  const required = SBD_SCHEMA[templateKey]?.requiredFields ?? [];
  return required
    .filter((field) => !profile[field as SbdFieldKey])
    .map((field) => `Missing required field for ${templateKey}: ${field}`);
}

export async function fillTenderPack(params: FillTenderPackParams): Promise<TenderFillResult> {
  const { templateKey, profile, outputMode } = params;

  const templatePath = resolveTemplatePath(templateKey);
  const fieldMapUsed = buildFieldMap(profile);
  const warnings = getRequiredMissingWarnings(templateKey, profile);

  let templateBytes: Buffer;
  try {
    templateBytes = await fs.readFile(templatePath);
  } catch {
    return {
      ok: false,
      error: `Template file not found for key '${templateKey}' at ${templatePath}`,
      warnings,
      fieldMapUsed,
    };
  }

  try {
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    const fields = form.getFields();
    for (const field of fields) {
      const name = field.getName();
      const value = fieldMapUsed[name] ?? "";
      try {
        if ("setText" in field && typeof (field as { setText?: unknown }).setText === "function") {
          (field as { setText: (v: string) => void }).setText(value);
        }
      } catch {
        warnings.push(`Unable to set field '${name}'`);
      }
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
      fieldMapUsed,
    };
  }
}
