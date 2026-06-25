import { extractTextFromPdfDetailed } from "@/lib/pdf/extractTextFromPdf";
import type { QsBoqParsedDocument, QsBoqParserInput } from "./types";

export async function parsePdfBoq(input: QsBoqParserInput): Promise<QsBoqParsedDocument> {
  const extracted = await extractTextFromPdfDetailed(input.buffer, {
    filename: input.fileName,
    documentType: "qs_boq",
  });

  return {
    fileType: "pdf",
    parserUsed: extracted.source === "OCR" ? "pdf-ocr-parser" : "pdf-text-parser",
    extractionSource: extracted.source === "OCR" ? "ocr" : extracted.source === "PDF_TEXT" ? "directText" : "empty",
    ocrUsed: extracted.source === "OCR",
    text: extracted.text,
    pageCount: extracted.pageCount,
  };
}
