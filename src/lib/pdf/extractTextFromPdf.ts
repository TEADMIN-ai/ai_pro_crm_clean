import { runOCR } from "@/server/services/ocrService";
import { loadPdfJsForNode } from "./loadPdfJsForNode";

const MIN_DIRECT_TEXT_LENGTH = 24;
const PDF_TEXT_TIMEOUT_MS = 15000;
const OCR_TIMEOUT_MS = 45000;
export type PdfExtractionSource = "PDF_TEXT" | "OCR" | "EMPTY";

export type PdfExtractionResult = {
  text: string;
  source: PdfExtractionSource;
  pageCount: number;
  directTextLength: number;
  ocrTextLength: number;
};

type PdfExtractionOptions = {
  filename?: string;
  minTextLength?: number;
};

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function hasMeaningfulDirectText(value: string, minTextLength: number): boolean {
  if (value.length >= minTextLength) {
    return true;
  }

  const tokens = value.split(/\s+/).filter(Boolean);
  const alphanumericCount = (value.match(/[A-Za-z0-9]/g) ?? []).length;
  return tokens.length >= 3 && alphanumericCount >= 16;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function extractTextWithPdfJs(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const runtime = await loadPdfJsForNode("pdf.extractTextFromPdf");
  const pdfjs = runtime.pdfjs;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    verbosity: 0,
  });
  const document = await loadingTask.promise;

  try {
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);

      try {
        const content = await withTimeout<{
          items: unknown[];
        }>(
          page.getTextContent(),
          PDF_TEXT_TIMEOUT_MS,
          `pdfjs_page_${pageNumber}`
        );
        const segments = content.items.map((item: unknown) => {
          if (!item || typeof item !== "object" || !("str" in item)) {
            return "";
          }

          const textItem = item as { str?: unknown; hasEOL?: unknown };
          const value = typeof textItem.str === "string" ? textItem.str : "";
          return textItem.hasEOL ? `${value}\n` : value;
        });

        pageTexts.push(segments.join(" "));
      } finally {
        page.cleanup();
      }
    }

    return {
      text: normalizeExtractedText(pageTexts.join("\n\n")),
      pageCount: document.numPages,
    };
  } catch (error) {
    console.warn("[PDF_TEXT_EXTRACTION]", {
      stage: "pdfjs_text_extraction_failed",
      specifier: runtime.specifier,
      compatibilityMode: runtime.compatibilityMode,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await document.destroy();
  }
}

async function extractTextWithPdfParseDetailed(
  buffer: Buffer
): Promise<{ text: string; pageCount: number }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await withTimeout(parser.getText(), PDF_TEXT_TIMEOUT_MS, "pdf_parse");
  return {
    text: normalizeExtractedText(result.text || ""),
    pageCount: typeof result.total === "number" && Number.isFinite(result.total) ? result.total : 0,
  };
}

function decodePdfEscapedString(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, escaped: string) => {
      switch (escaped) {
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        case "b":
        case "f":
          return "";
        default:
          return escaped;
      }
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) =>
      String.fromCharCode(Number.parseInt(octal, 8))
    );
}

function extractTextWithRawPdfScan(buffer: Buffer): { text: string; pageCount: number } {
  const content = buffer.toString("latin1");
  const pageCount = Math.max(0, (content.match(/\/Type\s*\/Page\b/g) ?? []).length);
  const segments: string[] = [];
  const literalPattern = /\((?:\\.|[^\\()])*\)\s*T[jJ]/g;
  const arrayPattern = /\[((?:\s*(?:\((?:\\.|[^\\()])*\)|-?\d+(?:\.\d+)?)\s*)+)\]\s*TJ/g;

  for (const match of content.matchAll(literalPattern)) {
    const raw = match[0].replace(/\s*T[jJ]\s*$/, "");
    segments.push(decodePdfEscapedString(raw.slice(1, -1)));
  }

  for (const match of content.matchAll(arrayPattern)) {
    const arrayContent = match[1] ?? "";
    const parts = [...arrayContent.matchAll(/\((?:\\.|[^\\()])*\)/g)].map((part) =>
      decodePdfEscapedString(part[0].slice(1, -1))
    );
    if (parts.length) {
      segments.push(parts.join(""));
    }
  }

  return {
    text: normalizeExtractedText(segments.join("\n")),
    pageCount,
  };
}

export async function extractTextFromPdfDetailed(
  binary: Buffer | Uint8Array,
  options?: PdfExtractionOptions
): Promise<PdfExtractionResult> {
  const buffer = Buffer.isBuffer(binary) ? binary : Buffer.from(binary);
  const filename = options?.filename?.trim() || "document.pdf";
  const minTextLength = options?.minTextLength ?? MIN_DIRECT_TEXT_LENGTH;

  console.log("[PDF_TEXT_EXTRACTION]", {
    filename,
    stage: "start",
    bytes: buffer.length,
  });

  console.log("[PDF_DOWNLOAD]", {
    filename,
    bytes: buffer.length,
  });

  let pdfJsText = "";
  let pdfParseText = "";
  let rawScanText = "";
  let pageCount = 0;

  try {
    const result = await extractTextWithPdfJs(buffer);
    pageCount = result.pageCount;
    pdfJsText = result.text;

    console.log("[PDF_PAGE_COUNT]", {
      filename,
      pageCount,
    });

    console.log("[PDF_TEXT_LENGTH]", {
      filename,
      parser: "pdfjs",
      textLength: pdfJsText.length,
      pageCount,
    });
  } catch (error) {
    console.error("[PDF_TEXT_EXTRACTION]", {
      filename,
      stage: "pdfjs_error",
      bytes: buffer.length,
      pageCount,
      error: error instanceof Error ? error.message : error,
    });
  }

  if (pdfJsText.length < minTextLength) {
    try {
      const result = await extractTextWithPdfParseDetailed(buffer);
      pageCount = pageCount || result.pageCount;
      pdfParseText = result.text;

      console.log("[PDF_TEXT_LENGTH]", {
        filename,
        parser: "pdf-parse",
        textLength: pdfParseText.length,
        pageCount,
      });
    } catch (error) {
      console.error("[PDF_TEXT_EXTRACTION]", {
        filename,
        stage: "pdf_parse_error",
        bytes: buffer.length,
        pageCount,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  if (Math.max(pdfJsText.length, pdfParseText.length) < minTextLength) {
    try {
      const result = extractTextWithRawPdfScan(buffer);
      pageCount = pageCount || result.pageCount;
      rawScanText = result.text;

      console.log("[PDF_TEXT_LENGTH]", {
        filename,
        parser: "raw-pdf-scan",
        textLength: rawScanText.length,
        pageCount,
      });
    } catch (error) {
      console.error("[PDF_TEXT_EXTRACTION]", {
        filename,
        stage: "raw_pdf_scan_error",
        bytes: buffer.length,
        pageCount,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const directCandidates = [
    { parser: "pdfjs", text: pdfJsText },
    { parser: "pdf-parse", text: pdfParseText },
    { parser: "raw-pdf-scan", text: rawScanText },
  ];
  const bestDirectCandidate = directCandidates.reduce((best, candidate) =>
    candidate.text.length > best.text.length ? candidate : best
  );
  const directText = bestDirectCandidate.text;
  const directParser = bestDirectCandidate.parser;

  if (hasMeaningfulDirectText(directText, minTextLength)) {
    console.log("[PDF_TEXT_EXTRACTION]", {
      filename,
      stage: "direct_text_selected",
      parser: directParser,
      pageCount,
      textLength: directText.length,
    });

    console.log("[EXTRACTION_TEXT_LENGTH]", {
      filename,
      extractionSource: "PDF_TEXT",
      textLength: directText.length,
      pageCount,
      parser: directParser,
    });

    return {
      text: directText,
      source: "PDF_TEXT",
      pageCount,
      directTextLength: directText.length,
      ocrTextLength: 0,
    };
  }

  console.log("[OCR_FALLBACK]", {
    filename,
    pageCount,
    directTextLength: directText.length,
    parser: directParser,
    activated: true,
    reason: directText.length > 0 ? "direct_text_not_meaningful" : "direct_text_empty",
  });

  console.log("[OCR_PAGE_RENDER]", {
    filename,
    pageCount,
    mode: "document_ocr",
  });

  let ocrText = "";

  try {
    ocrText = normalizeExtractedText(await withTimeout(
      runOCR(buffer, {
        filename,
        mimeType: "application/pdf",
        pageCount,
      }),
      OCR_TIMEOUT_MS,
      "ocr"
    ));
  } catch (error) {
    console.error("[OCR_FALLBACK]", {
      filename,
      pageCount,
      activated: true,
      failed: true,
      error: error instanceof Error ? error.message : error,
    });
  }

  console.log("[OCR_TEXT_LENGTH]", {
    filename,
    pageCount,
    textLength: ocrText.length,
  });

  console.log("[EXTRACTION_TEXT_LENGTH]", {
    filename,
    extractionSource: ocrText.length > 0 ? "OCR" : "EMPTY",
    textLength: ocrText.length,
    pageCount,
  });

  if (ocrText.length > 0) {
    return {
      text: ocrText,
      source: "OCR",
      pageCount,
      directTextLength: directText.length,
      ocrTextLength: ocrText.length,
    };
  }

  return {
    text: directText,
    source: directText.length > 0 ? "PDF_TEXT" : "EMPTY",
    pageCount,
    directTextLength: directText.length,
    ocrTextLength: 0,
  };
}

export async function extractTextFromPdf(
  binary: Buffer | Uint8Array,
  options?: PdfExtractionOptions
): Promise<string> {
  const result = await extractTextFromPdfDetailed(binary, options);
  return result.text;
}
