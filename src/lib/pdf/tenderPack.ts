import { PDFDocument } from "pdf-lib";

import {
  generateSBD1,
  generateSBD1WithValidation,
  loadSBD1Template,
  type ContractorData,
  type SBD1ValidationResult,
} from "./sbd1AutoFill";
import { generateSBD4, loadSBD4Template, type SBD4Data } from "./sbd4AutoFill";

export type TenderPackData = {
  sbd1: ContractorData;
  sbd4: SBD4Data;
};

export type TenderPackTemplates = {
  sbd1TemplateBytes?: Uint8Array;
  sbd4TemplateBytes?: Uint8Array;
};

export type GenerateTenderPackInput = TenderPackData & TenderPackTemplates;

export type GenerateTenderPackResult = {
  pdfBytes: Uint8Array;
  validation?: {
    sbd1: SBD1ValidationResult;
  };
};

async function resolveTenderPackTemplates(input: TenderPackTemplates): Promise<{
  sbd1TemplateBytes: Uint8Array;
  sbd4TemplateBytes: Uint8Array;
}> {
  const [sbd1TemplateBytes, sbd4TemplateBytes] = await Promise.all([
    input.sbd1TemplateBytes ?? loadSBD1Template(),
    input.sbd4TemplateBytes ?? loadSBD4Template(),
  ]);

  return {
    sbd1TemplateBytes,
    sbd4TemplateBytes,
  };
}

async function mergePdfBuffers(buffers: Uint8Array[]): Promise<Uint8Array> {
  const finalDoc = await PDFDocument.create();

  for (const buffer of buffers) {
    const sourceDoc = await PDFDocument.load(buffer);
    const pages = await finalDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());

    pages.forEach((page) => finalDoc.addPage(page));
  }

  return finalDoc.save();
}

export async function generateTenderPack(input: GenerateTenderPackInput): Promise<Uint8Array> {
  const { pdfBytes } = await generateTenderPackWithValidation(input);

  return pdfBytes;
}

export async function generateTenderPackWithValidation(
  input: GenerateTenderPackInput
): Promise<GenerateTenderPackResult> {
  const { sbd1TemplateBytes, sbd4TemplateBytes } = await resolveTenderPackTemplates(input);

  const sbd1Result = await generateSBD1WithValidation(sbd1TemplateBytes, input.sbd1);
  if (!sbd1Result.validation.isValid) {
    console.warn("Tender pack SBD1 validation warnings:", sbd1Result.validation.missingFields);
  }

  const sbd4Bytes = await generateSBD4(sbd4TemplateBytes, input.sbd4);
  const pdfBytes = await mergePdfBuffers([sbd1Result.pdfBytes, sbd4Bytes]);

  return {
    pdfBytes,
    validation: {
      sbd1: sbd1Result.validation,
    },
  };
}

export async function generateTenderPackFromTemplates(
  sbd1TemplateBytes: Uint8Array,
  sbd4TemplateBytes: Uint8Array,
  data: TenderPackData
): Promise<Uint8Array> {
  const sbd1Bytes = await generateSBD1(sbd1TemplateBytes, data.sbd1);
  const sbd4Bytes = await generateSBD4(sbd4TemplateBytes, data.sbd4);

  return mergePdfBuffers([sbd1Bytes, sbd4Bytes]);
}

export function downloadTenderPack(pdfBytes: Uint8Array) {
  const normalizedBytes = new Uint8Array(pdfBytes.byteLength);
  normalizedBytes.set(pdfBytes);

  const blob = new Blob([normalizedBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "Tender_Pack_SBD1_SBD4.pdf";
  anchor.click();

  URL.revokeObjectURL(url);
}
