import path from "node:path";
import { pathToFileURL } from "node:url";

import { runOCR } from "@/server/services/ocrService";
import {
  recordDocumentExtractionDiagnostic,
  type DocumentExtractionDiagnosticUpdate,
} from "@/lib/pdf/documentExtractionDiagnostics";
import { loadPdfJsForNode } from "./loadPdfJsForNode";

const MIN_DIRECT_TEXT_LENGTH = 24;
const PDF_TEXT_TIMEOUT_MS = 15000;
const OCR_TIMEOUT_MS = 45000;
const PDFJS_CMAP_URL = pathToFileURL(
  path.join(process.cwd(), "node_modules", "pdfjs-dist", "cmaps") + path.sep
).href;
const PDFJS_STANDARD_FONT_DATA_URL = pathToFileURL(
  path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep
).href;
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
  skipOcrFallback?: boolean;
  contractorId?: string | null;
  documentType?: string | null;
  storagePath?: string | null;
  diagnosticId?: string | null;
};

function textPreview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function logNormalization(filename: string, parser: string, input: string, output: string) {
  console.log("[NORMALIZATION_INPUT_LENGTH]", {
    filename,
    parser,
    textLength: input.length,
  });

  console.log("[NORMALIZATION_OUTPUT_LENGTH]", {
    filename,
    parser,
    textLength: output.length,
  });
}

function normalizeExtractedText(value: string, context?: { filename: string; parser: string }): string {
  const normalized = value
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (context) {
    logNormalization(context.filename, context.parser, value, normalized);
  }

  return normalized;
}

function hasMeaningfulDirectText(value: string, minTextLength: number): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < minTextLength) {
    return false;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const alphanumericCount = (normalized.match(/[A-Za-z0-9]/g) ?? []).length;
  const corruptedCharacterCount = (normalized.match(/[ï¿½\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
  const corruptedCharacterRatio = normalized.length > 0 ? corruptedCharacterCount / normalized.length : 0;
  const hasCorruption =
    corruptedCharacterCount > 0 ||
    corruptedCharacterRatio > 0.02 ||
    /[^\x09\x0A\x0D\x20-\x7E]/.test(normalized.slice(0, Math.min(1000, normalized.length)));

  return tokens.length >= 5 && alphanumericCount >= 30 && !hasCorruption;
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

async function extractTextWithPdfJs(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; pageCount: number }> {
  const runtime = await loadPdfJsForNode("pdf.extractTextFromPdf");
  const pdfjs = runtime.pdfjs;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    verbosity: 0,
  });
  const document = await loadingTask.promise;

  try {
    const pageTexts: string[] = [];

    console.log("[PDFJS_PAGE_COUNT]", {
      filename,
      pageCount: document.numPages,
      specifier: runtime.specifier,
      compatibilityMode: runtime.compatibilityMode,
    });

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

        const pageText = segments.join(" ");
        console.log("[PDFJS_PAGE_TEXT_LENGTH]", {
          filename,
          pageNumber,
          textLength: pageText.length,
          itemCount: content.items.length,
        });
        console.log("[PDFJS_PAGE_TEXT_PREVIEW]", {
          filename,
          pageNumber,
          preview: textPreview(pageText),
        });

        pageTexts.push(pageText);
      } finally {
        page.cleanup();
      }
    }

    const joinedText = pageTexts.join("\n\n");
    const normalizedText = normalizeExtractedText(joinedText, { filename, parser: "pdfjs" });

    console.log("[PDFJS_EXTRACTION_SUCCESS]", {
      filename,
      pageCount: document.numPages,
      textLength: normalizedText.length,
      preview: textPreview(normalizedText),
    });

    return {
      text: normalizedText,
      pageCount: document.numPages,
    };
  } catch (error) {
    console.error("[PDFJS_EXTRACTION_FAILURE]", {
      filename,
      specifier: runtime.specifier,
      compatibilityMode: runtime.compatibilityMode,
      error: error instanceof Error ? error.message : String(error),
    });
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
  buffer: Buffer,
  filename: string
): Promise<{ text: string; pageCount: number }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await withTimeout(parser.getText(), PDF_TEXT_TIMEOUT_MS, "pdf_parse");
    const rawText = result.text || "";
    const text = normalizeExtractedText(rawText, { filename, parser: "pdf-parse" });
    const pageCount =
      typeof result.total === "number" && Number.isFinite(result.total) ? result.total : 0;

    console.log("[PDFPARSE_TEXT_LENGTH]", {
      filename,
      textLength: text.length,
      pageCount,
    });
    console.log("[PDFPARSE_TEXT_PREVIEW]", {
      filename,
      preview: textPreview(text),
    });
    console.log("[PDFPARSE_SUCCESS]", {
      filename,
      textLength: text.length,
      pageCount,
    });

    return {
      text,
      pageCount,
    };
  } catch (error) {
    console.error("[PDFPARSE_FAILURE]", {
      filename,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await parser.destroy();
  }
}

function buildExtractionResult(params: {
  filename: string;
  text: string;
  source: PdfExtractionSource;
  pageCount: number;
  directTextLength: number;
  ocrTextLength: number;
}): PdfExtractionResult {
  const result: PdfExtractionResult = {
    text: params.text,
    source: params.source,
    pageCount: params.pageCount,
    directTextLength: params.directTextLength,
    ocrTextLength: params.ocrTextLength,
  };

  console.log("[RETURNED_TEXT_LENGTH]", {
    filename: params.filename,
    textLength: result.text.length,
    extractionSource: result.source,
  });

  console.log("[DOCUMENT_EXTRACTION_EVIDENCE]", {
    filename: params.filename,
    directTextLength: result.directTextLength,
    ocrTextLength: result.ocrTextLength,
    extractedTextLength: result.text.length,
    extractionSource: result.source,
  });

  return {
    ...result,
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
  let diagnosticId = options?.diagnosticId?.trim() || null;
  const diagnosticBase = (): DocumentExtractionDiagnosticUpdate => ({
    diagnosticId: diagnosticId ?? undefined,
    contractorId: options?.contractorId ?? null,
    documentType: options?.documentType ?? null,
    storagePath: options?.storagePath ?? null,
    fileName: filename,
  });
  const updateDiagnostic = async (update: DocumentExtractionDiagnosticUpdate) => {
    const savedId = await recordDocumentExtractionDiagnostic({
      ...diagnosticBase(),
      ...update,
    });
    diagnosticId = savedId ?? diagnosticId;
  };
  const extractionStartedAt = Date.now();

  await updateDiagnostic({
    step: "PDF_EXTRACTION",
    enteredAt: new Date().toISOString(),
    pageCount: null,
    pdfTextLength: 0,
    ocrAttempted: false,
    ocrStarted: false,
    ocrCompleted: false,
    ocrTextLength: 0,
    renderSuccess: null,
    renderFailureReason: null,
    ocrFailureReason: null,
    finalExtractionSource: null,
    metadata: { bytes: buffer.length },
  });

  console.log("[PDF_TEXT_EXTRACTION]", {
    filename,
    stage: "start",
    bytes: buffer.length,
  });

  console.log("[PDF_DOWNLOAD]", {
    filename,
    bytes: buffer.length,
  });

  console.log("[PDF_DOWNLOAD_SUCCESS]", {
    filename,
    bytes: buffer.length,
  });

  console.log("[PDF_BYTES_LENGTH]", {
    filename,
    bytes: buffer.length,
  });

  let pdfJsText = "";
  let pdfParseText = "";
  let rawScanText = "";
  let pageCount = 0;

  try {
    const result = await extractTextWithPdfJs(buffer, filename);
    pageCount = result.pageCount;
    pdfJsText = result.text;
    await updateDiagnostic({
      step: "PDF_EXTRACTION",
      pageCount,
      pdfTextLength: pdfJsText.length,
      metadata: { parser: "pdfjs", timingMs: Date.now() - extractionStartedAt },
    });

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
    await updateDiagnostic({
      step: "PDF_EXTRACTION",
      pageCount,
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { parser: "pdfjs", timingMs: Date.now() - extractionStartedAt },
    });
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
      const result = await extractTextWithPdfParseDetailed(buffer, filename);
      pageCount = pageCount || result.pageCount;
      pdfParseText = result.text;
      await updateDiagnostic({
        step: "PDF_EXTRACTION",
        pageCount,
        pdfTextLength: Math.max(pdfJsText.length, pdfParseText.length),
        metadata: { parser: "pdf-parse", timingMs: Date.now() - extractionStartedAt },
      });

      console.log("[PDF_TEXT_LENGTH]", {
        filename,
        parser: "pdf-parse",
        textLength: pdfParseText.length,
        pageCount,
      });
    } catch (error) {
      await updateDiagnostic({
        step: "PDF_EXTRACTION",
        pageCount,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: { parser: "pdf-parse", timingMs: Date.now() - extractionStartedAt },
      });
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
      await updateDiagnostic({
        step: "PDF_EXTRACTION",
        pageCount,
        pdfTextLength: Math.max(pdfJsText.length, pdfParseText.length, rawScanText.length),
        metadata: { parser: "raw-pdf-scan", timingMs: Date.now() - extractionStartedAt },
      });

      console.log("[PDF_TEXT_LENGTH]", {
        filename,
        parser: "raw-pdf-scan",
        textLength: rawScanText.length,
        pageCount,
      });
    } catch (error) {
      await updateDiagnostic({
        step: "PDF_EXTRACTION",
        pageCount,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: { parser: "raw-pdf-scan", timingMs: Date.now() - extractionStartedAt },
      });
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
  const meaningfulDirectText = hasMeaningfulDirectText(directText, minTextLength);
  await updateDiagnostic({
    step: "OCR_TRIGGER_DECISION",
    pageCount,
    pdfTextLength: directText.length,
    ocrAttempted: !meaningfulDirectText,
    metadata: {
      directParser,
      minTextLength,
      meaningfulDirectText,
      reason: meaningfulDirectText
        ? "direct_text_available"
        : directText.length > 0
          ? "direct_text_not_meaningful"
          : "direct_text_empty",
    },
  });

  if (meaningfulDirectText || options?.skipOcrFallback) {
    console.log("[PDF_TEXT_EXTRACTION]", {
      filename,
      stage: options?.skipOcrFallback ? "direct_text_only" : "direct_text_selected",
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

    const result = buildExtractionResult({
      filename,
      text: directText,
      source: "PDF_TEXT",
      pageCount,
      directTextLength: directText.length,
      ocrTextLength: 0,
    });
    await updateDiagnostic({
      step: "ANALYSIS_EXECUTION",
      pageCount,
      pdfTextLength: directText.length,
      ocrAttempted: false,
      ocrStarted: false,
      ocrCompleted: false,
      ocrTextLength: 0,
      finalExtractionSource: result.source,
      success: true,
      timingMs: Date.now() - extractionStartedAt,
    });
    return result;
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
        onDiagnostic: (event) =>
          updateDiagnostic({
            step: event.step,
            success: event.success ?? undefined,
            errorMessage: event.errorMessage ?? null,
            pageCount,
            pdfTextLength: directText.length,
            ocrAttempted: true,
            ocrStarted: event.ocrStarted ?? undefined,
            ocrCompleted: event.ocrCompleted ?? undefined,
            ocrTextLength: event.ocrTextLength ?? undefined,
            renderSuccess: event.renderSuccess ?? undefined,
            renderFailureReason: event.renderFailureReason ?? undefined,
            ocrFailureReason: event.ocrFailureReason ?? undefined,
            metadata: event.metadata,
          }),
      }),
      OCR_TIMEOUT_MS,
      "ocr"
    ));
  } catch (error) {
    await updateDiagnostic({
      step: "OCR_EXECUTION",
      pageCount,
      pdfTextLength: directText.length,
      ocrAttempted: true,
      ocrCompleted: true,
      ocrTextLength: 0,
      ocrFailureReason: error instanceof Error ? error.message : String(error),
      success: false,
      timingMs: Date.now() - extractionStartedAt,
    });
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
    const result = buildExtractionResult({
      filename,
      text: ocrText,
      source: "OCR",
      pageCount,
      directTextLength: directText.length,
      ocrTextLength: ocrText.length,
    });
    await updateDiagnostic({
      step: "ANALYSIS_EXECUTION",
      pageCount,
      pdfTextLength: directText.length,
      ocrAttempted: true,
      ocrCompleted: true,
      ocrTextLength: ocrText.length,
      finalExtractionSource: result.source,
      success: true,
      timingMs: Date.now() - extractionStartedAt,
    });
    return result;
  }

  const result = buildExtractionResult({
    filename,
    text: directText,
    source: directText.length > 0 ? "PDF_TEXT" : "EMPTY",
    pageCount,
    directTextLength: directText.length,
    ocrTextLength: 0,
  });
  await updateDiagnostic({
    step: "ANALYSIS_EXECUTION",
    pageCount,
    pdfTextLength: directText.length,
    ocrAttempted: true,
    ocrCompleted: true,
    ocrTextLength: 0,
    ocrFailureReason: "ocr_returned_empty_text",
    finalExtractionSource: result.source,
    success: false,
    timingMs: Date.now() - extractionStartedAt,
  });
  return result;
}

export async function extractTextFromPdf(
  binary: Buffer | Uint8Array,
  options?: PdfExtractionOptions
): Promise<string> {
  const result = await extractTextFromPdfDetailed(binary, options);
  return result.text;
}
