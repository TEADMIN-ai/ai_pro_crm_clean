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
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function groupByLine(records: AnchorTextRecord[]): AnchorTextRecord[][] {
  const sortedRecords = [...records].sort((left, right) => {
    if (left.pageIndex !== right.pageIndex) {
      return left.pageIndex - right.pageIndex;
    }

    const yDelta = Math.abs(left.y - right.y);
    if (yDelta > 2.5) {
      return right.y - left.y;
    }

    return left.x - right.x;
  });
  const lines: AnchorTextRecord[][] = [];

  for (const record of sortedRecords) {
    const lastLine = lines.at(-1);
    const lastRecord = lastLine?.at(-1);

    if (
      lastLine &&
      lastRecord &&
      lastRecord.pageIndex === record.pageIndex &&
      Math.abs(lastRecord.y - record.y) <= 2.5
    ) {
      lastLine.push(record);
      continue;
    }

    lines.push([record]);
  }

  return lines;
}

function buildLineCandidates(records: AnchorTextRecord[]): AnchorTextRecord[] {
  const candidates: AnchorTextRecord[] = [...records];

  for (const line of groupByLine(records)) {
    const sortedLine = [...line].sort((left, right) => left.x - right.x);
    const maxWindow = Math.min(sortedLine.length, 8);

    for (let start = 0; start < sortedLine.length; start += 1) {
      for (let length = 2; length <= maxWindow && start + length <= sortedLine.length; length += 1) {
        const slice = sortedLine.slice(start, start + length);
        const text = slice.map((entry) => entry.text.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

        if (!text) {
          continue;
        }

        const first = slice[0];
        const last = slice[slice.length - 1];
        candidates.push({
          pageIndex: first.pageIndex,
          text,
          x: first.x,
          y: Math.min(...slice.map((entry) => entry.y)),
          width: Math.max(last.x + last.width - first.x, 0),
          height: Math.max(...slice.map((entry) => entry.height)),
        });
      }
    }
  }

  return candidates;
}

function computeAnchorMatchConfidence(anchorText: string, candidateText: string): number {
  const normalizedAnchor = normalizeText(anchorText);
  const normalizedCandidate = normalizeText(candidateText);

  if (!normalizedAnchor || !normalizedCandidate) {
    return 0;
  }

  if (normalizedCandidate === normalizedAnchor) {
    return 0.99;
  }

  const anchorTokens = normalizedAnchor.split(" ").filter(Boolean);
  const candidateTokens = normalizedCandidate.split(" ").filter(Boolean);

  if (
    anchorTokens.length === 1 &&
    anchorTokens[0] === "date" &&
    candidateTokens.length > 1 &&
    !candidateTokens.some((token) => ["signed", "signature", "form"].includes(token))
  ) {
    return 0;
  }

  const candidateTokenSet = new Set(candidateTokens);
  const sharedTokenCount = anchorTokens.reduce(
    (count, token) => count + (candidateTokenSet.has(token) ? 1 : 0),
    0
  );

  if (sharedTokenCount === 0) {
    return 0;
  }

  const coverage = sharedTokenCount / anchorTokens.length;
  const precision = sharedTokenCount / candidateTokens.length;
  const containsBoost =
    normalizedCandidate.includes(normalizedAnchor) || normalizedAnchor.includes(normalizedCandidate) ? 0.08 : 0;
  const score = coverage * 0.72 + precision * 0.2 + containsBoost;

  return Number(Math.max(0, Math.min(0.97, score)).toFixed(2));
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
  const pageRecords = buildLineCandidates(records.filter((record) => record.pageIndex === pageIndex));

  let bestMatch: IntelligentAnchorMatch | null = null;

  for (const record of pageRecords) {
    const normalizedRecord = normalizeText(record.text);

    if (!normalizedRecord) {
      continue;
    }

    const confidence = computeAnchorMatchConfidence(normalizedAnchor, normalizedRecord);
    if (confidence < 0.6) {
      continue;
    }

    if (
      !bestMatch ||
      confidence > bestMatch.confidence ||
      (confidence === bestMatch.confidence && normalizedRecord.length > normalizeText(bestMatch.sourceText).length)
    ) {
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
