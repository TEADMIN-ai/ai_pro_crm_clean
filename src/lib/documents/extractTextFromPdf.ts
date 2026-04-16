import { PDFParse } from "pdf-parse";

export async function extractTextFromPdf(buffer: Buffer) {
  try {
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    return data.text || "";
  } catch (err) {
    console.error("PDF extraction failed:", err);
    return "";
  }
}
