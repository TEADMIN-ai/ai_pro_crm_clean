import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import * as Tesseract from "tesseract.js";

/**
 * Disable worker usage for Node / Next.js server environments
 */
(pdfjs as any).GlobalWorkerOptions.workerSrc = "";

/**
 * Normalize binary data into Uint8Array
 */
function normalizePdfBinary(
  data: Buffer | Uint8Array | ArrayBuffer
): Uint8Array {
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  if (data instanceof Uint8Array) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  throw new Error("Unsupported PDF binary type");
}

async function loadPdfDocument(binary: Buffer | Uint8Array | ArrayBuffer) {
  const pdfData = normalizePdfBinary(binary);

  return pdfjs.getDocument({
    data: pdfData,
    disableWorker: true,
  } as any).promise;
}

export async function extractTextFromPdfOcr(
  binary: Buffer | Uint8Array | ArrayBuffer
): Promise<string> {
  try {
    const pdfData = normalizePdfBinary(binary);
    const result = await Tesseract.recognize(Buffer.from(pdfData), "eng", {
      logger: () => undefined,
    });

    return result.data.text.trim();
  } catch (error) {
    console.error("PDF OCR failed:", error);
    return "";
  }
}

/**
 * Extract text safely from a PDF
 */
export async function extractTextFromPdf(
  binary: Buffer | Uint8Array | ArrayBuffer
): Promise<string> {
  try {
    const pdf = await loadPdfDocument(binary);

    console.log("PDF pages:", pdf.numPages);

    let fullText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);

      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: { str?: string } | { type?: string }) => ("str" in item ? item.str ?? "" : ""))
        .join(" ");

      fullText += pageText + "\n";
    }

    console.log("Extracted text length:", fullText.length);

    return fullText.trim();
  } catch (err) {
    console.error("PDF extraction failed:", err);
    return "";
  }
}
