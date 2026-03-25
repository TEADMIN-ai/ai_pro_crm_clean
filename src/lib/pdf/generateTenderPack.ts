import { PDFDocument } from "pdf-lib";
import {
  isTenderData,
  mapLegacyTenderToTenderData,
  type TenderDataSource,
} from "@/lib/tender/mappers/tender.mapper";
import { generateSBD1OverlayDocument } from "@/lib/pdf/sbd1-overlay/service";
import { generateSBD4OverlayDocument } from "@/lib/pdf/sbd4-overlay/service";
import { hydrateTenderDataPricing } from "@/lib/pricing/services/price.service";
import type { TenderData } from "@/types/tender.types";

async function generateTenderPackDocument(tenderData: TenderData) {
  const sbd1Bytes = await generateSBD1OverlayDocument(tenderData);
  const sbd4Bytes = await generateSBD4OverlayDocument(tenderData);

  if (!sbd1Bytes || !sbd4Bytes) {
    console.error("Failed to generate individual documents");
    return null;
  }

  const mergedPdf = await PDFDocument.create();

  const sbd1Doc = await PDFDocument.load(sbd1Bytes);
  const sbd4Doc = await PDFDocument.load(sbd4Bytes);

  const sbd1Pages = await mergedPdf.copyPages(sbd1Doc, sbd1Doc.getPageIndices());
  const sbd4Pages = await mergedPdf.copyPages(sbd4Doc, sbd4Doc.getPageIndices());

  sbd1Pages.forEach((page) => mergedPdf.addPage(page));
  sbd4Pages.forEach((page) => mergedPdf.addPage(page));

  return mergedPdf.save();
}

export async function generateTenderPack(data: TenderDataSource) {
  try {
    const mappedTenderData = isTenderData(data) ? data : mapLegacyTenderToTenderData(data);
    const tenderData = await hydrateTenderDataPricing(mappedTenderData);
    return await generateTenderPackDocument(tenderData);
  } catch (error) {
    console.error("Tender Pack Error:", error);
    return null;
  }
}
