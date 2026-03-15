import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

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
  if (data instanceof Uint8Array) return data;

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }

  throw new Error("Unsupported PDF binary type");
}

/**
 * Extract text safely from a PDF
 */
export async function extractTextFromPdf(
  binary: Buffer | Uint8Array | ArrayBuffer
): Promise<string> {
  try {
    const pdfData = normalizePdfBinary(binary);

    const loadingTask = pdfjs.getDocument({
      data: pdfData,
      disableWorker: true
    });

    const pdf = await loadingTask.promise;

    console.log("PDF pages:", pdf.numPages);

    let fullText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);

      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => item.str)
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