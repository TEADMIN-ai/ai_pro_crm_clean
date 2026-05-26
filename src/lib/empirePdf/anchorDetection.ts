import type { IntelligentAnchorMatch } from "./templates";
import { getPdfBinaryType, normalizePdfBinary } from "./utils/normalizePdfBinary";
import { loadPdfJsForNode } from "@/lib/pdf/loadPdfJsForNode";

type PdfJsTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

type AnchorTextRecord = {
  pageIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

async function extractAnchorTextRecords(pdfBytes: Buffer | Uint8Array | ArrayBuffer): Promise<AnchorTextRecord[]> {
  const runtime = await loadPdfJsForNode("empirePdf.anchorDetection");
  const pdfjs = runtime.pdfjs;
  const normalizedPdfBytes = normalizePdfBinary(pdfBytes);

  console.info("[PDFJS_ANCHOR_DIAGNOSTICS]", {
    stage: "binary_normalization_applied",
    byteLength: normalizedPdfBytes.byteLength,
    originalType: getPdfBinaryType(pdfBytes),
    normalizedType: getPdfBinaryType(normalizedPdfBytes),
  });

  const loadingTask = pdfjs.getDocument({
    data: normalizedPdfBytes,
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
    const records: AnchorTextRecord[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      for (const item of content.items as PdfJsTextItem[]) {
        const text = typeof item.str === "string" ? item.str.trim() : "";
        const transform = Array.isArray(item.transform) ? item.transform : [];

        if (!text || transform.length < 6) {
          continue;
        }

        const x = Number(transform[4]) || 0;
        const topBasedY = Number(transform[5]) || 0;
        const height = Math.abs(Number(item.height) || Number(transform[3]) || 10);
        const y = viewport.height - topBasedY;
        const width = Number(item.width) || text.length * 5;

        records.push({
          pageIndex: pageNumber - 1,
          text,
          x,
          y,
          width,
          height,
        });
      }

      page.cleanup();
    }

    console.info("[PDFJS_ANCHOR_DIAGNOSTICS]", {
      stage: "anchor_extraction_success",
      specifier: runtime.specifier,
      compatibilityMode: runtime.compatibilityMode,
      pageCount: document.numPages,
      recordCount: records.length,
    });

    return records;
  } catch (error) {
    console.warn("[PDFJS_ANCHOR_DIAGNOSTICS]", {
      stage: "anchor_extraction_failed",
      specifier: runtime.specifier,
      compatibilityMode: runtime.compatibilityMode,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await document.destroy();
  }
}

function findAnchorInRecords(
  records: AnchorTextRecord[],
  anchorText: string,
  pageIndex: number
): IntelligentAnchorMatch | null {
  const normalizedAnchor = normalizeText(anchorText);
  const pageRecords = records.filter((record) => record.pageIndex === pageIndex);

  let bestMatch: IntelligentAnchorMatch | null = null;

  for (const record of pageRecords) {
    const normalizedRecord = normalizeText(record.text);

    if (!normalizedRecord) {
      continue;
    }

    const exact = normalizedRecord === normalizedAnchor;
    const contains = normalizedRecord.includes(normalizedAnchor) || normalizedAnchor.includes(normalizedRecord);

    if (!exact && !contains) {
      continue;
    }

    const confidence = exact ? 0.98 : 0.82;
    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = {
        pageIndex: record.pageIndex,
        x: record.x,
        y: record.y,
        width: record.width,
        height: record.height,
        confidence,
        sourceText: record.text,
      };
    }
  }

  return bestMatch;
}

export async function createAnchorResolver(pdfBytes: Buffer | Uint8Array | ArrayBuffer) {
  const records = await extractAnchorTextRecords(pdfBytes);

  console.info("[PDFJS_ANCHOR_DIAGNOSTICS]", {
    stage: "anchor_resolver_ready",
    recordCount: records.length,
  });

  return {
    detect(anchorText: string, pageIndex: number): IntelligentAnchorMatch | null {
      return findAnchorInRecords(records, anchorText, pageIndex);
    },
  };
}

export async function detectAnchor(
  pdfBytes: Buffer | Uint8Array | ArrayBuffer,
  anchorText: string,
  pageIndex: number
): Promise<IntelligentAnchorMatch | null> {
  const resolver = await createAnchorResolver(pdfBytes);
  return resolver.detect(anchorText, pageIndex);
}
