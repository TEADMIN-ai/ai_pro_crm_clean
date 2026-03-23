import { PDFDocument } from "pdf-lib";
import { generateSBD1Overlay } from "@/lib/pdf/sbd1Overlay";
import { generateSBD4Overlay } from "@/lib/pdf/sbd4Overlay";

export async function generateTenderPack(data: any) {
  try {
    const sbd1Bytes = await generateSBD1Overlay(data);
    const sbd4Bytes = await generateSBD4Overlay(data);

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

    const finalPdf = await mergedPdf.save();

    return finalPdf;
  } catch (error) {
    console.error("Tender Pack Error:", error);
    return null;
  }
}
