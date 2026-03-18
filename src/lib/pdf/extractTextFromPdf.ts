import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { runOCR } from "@/server/services/ocrService";

/**
 * Normalize binary data into Uint8Array
 */
function normalizePdfBinary(
  data: Buffer | Uint8Array
): Uint8Array {
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  if (data instanceof Uint8Array) {
    return data;
  }

  throw new Error("Unsupported PDF binary type");
}

async function loadPdfDocument(binary: Buffer | Uint8Array) {
  const pdfData = normalizePdfBinary(binary);

  return pdfjs.getDocument({
    data: pdfData,
    disableWorker: true,
  } as any).promise;
}

/**
 * Extract embedded text with pdfjs first.
 * This is the fast path for text-based PDFs.
 */
async function extractEmbeddedText(binary: Buffer | Uint8Array): Promise<string> {
  const pdf = await loadPdfDocument(binary);

  try {
    const maxPages = Math.min(pdf.numPages, 2);
    console.log("PDF Pages Processed:", maxPages);

    let fullText = "";

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: { str?: string } | { type?: string }) =>
          "str" in item ? item.str ?? "" : ""
        )
        .join(" ");

      fullText += pageText + "\n";
    }

    return fullText.trim();
  } finally {
    try {
      await pdf.destroy();
    } catch (error) {
      console.error("PDF cleanup failed:", error);
    }
  }
}

async function runOcrFallback(binary: Buffer | Uint8Array): Promise<string> {
  try {
    const input = Buffer.isBuffer(binary) ? binary : Buffer.from(binary);
    return await runOCR(input, {
      filename: "document.pdf",
      mimeType: "application/pdf",
    });
  } catch (error) {
    console.error("PDF OCR fallback failed:", error);
    return "";
  }
}

/**
 * Extract text safely from a PDF.
 *
 * Separation of concerns:
 * - `pdfjs` handles embedded-text extraction in the Next.js runtime.
 * - OCR is delegated to a dedicated service import instead of being configured here.
 * - OCR failures always degrade to an empty string so document processing stays stable.
 */
export async function extractTextFromPdf(
  binary: Buffer | Uint8Array
): Promise<string> {
  try {
    console.log("Running PDF extraction...");
    const extractedText = await extractEmbeddedText(binary);

    if (extractedText.length > 0) {
      console.log("PDF embedded text length:", extractedText.length);
      console.log("Final verification text preview:", extractedText.slice(0, 500));
      return extractedText;
    }
  } catch (error) {
    console.error("PDF text extraction failed:", error);
  }

  console.log("PDF extraction failed, falling back to OCR");
  const ocrText = await runOcrFallback(binary);
  console.log("Final verification text preview:", ocrText.slice(0, 500));
  return ocrText;
}
