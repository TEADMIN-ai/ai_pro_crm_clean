import OpenAI from "openai";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadPdfJsForNode } from "@/lib/pdf/loadPdfJsForNode";
import { extractTextFromPdfDetailed } from "@/lib/pdf/extractTextFromPdf";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import {
  OCR_MODEL_CANDIDATES,
} from "@/server/services/ocrService";
import {
  calculateVehicleFinanceTrainingConfidence,
  extractVehicleFinanceTrainingFields,
  getVehicleFinanceTrainingMissingFields,
} from "../extractors";
import {
  getVehicleFinanceTrainingCategories,
  getVehicleFinanceTrainingTemplate,
} from "../datasets";
import type {
  VehicleFinanceTrainingCategory,
  VehicleFinanceTrainingDocument,
  VehicleFinanceTrainingExtractionMethod,
  VehicleFinanceTrainingResult,
} from "../types";
import {
  VEHICLE_FINANCE_TRAINING_DOCUMENT_COLLECTION,
  VEHICLE_FINANCE_TRAINING_RESULT_COLLECTION,
} from "../types";

const MAX_LOCAL_OCR_PDF_PAGES = 3;
const PDF_RENDER_SCALE = 3;
const SPARSE_TEXT_PSM = "11" as unknown as import("tesseract.js").PSM;
const TESSERACT_CACHE_PATH = path.join(os.tmpdir(), "tesseract-cache");

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function textPreview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 250);
}

function countSharedTokens(left: string, right: string): number {
  const leftTokens = new Set(left.toLowerCase().split(/\W+/).filter(Boolean));
  const rightTokens = new Set(right.toLowerCase().split(/\W+/).filter(Boolean));
  let shared = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  });
  return shared;
}

function compareTextSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.toLowerCase().split(/\W+/).filter(Boolean));
  const rightTokens = new Set(right.toLowerCase().split(/\W+/).filter(Boolean));
  const union = new Set([...leftTokens, ...rightTokens]).size;
  if (!union) return 0;
  return Math.round((countSharedTokens(left, right) / union) * 100);
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
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

async function runOpenAiOcr(buffer: Buffer, filename: string): Promise<string> {
  const client = getOpenAIClient();
  if (!client) {
    return "";
  }

  const mimeType = "application/pdf";
  const input = {
    type: "input_file" as const,
    filename,
    file_data: `data:${mimeType};base64,${buffer.toString("base64")}`,
  };

  let response: { output_text?: string } | null = null;
  for (const model of OCR_MODEL_CANDIDATES) {
    try {
      response = (await client.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [
              input,
              {
                type: "input_text",
                text: "Extract all readable text from this document. Return only extracted text.",
              },
            ],
          },
        ],
      })) as { output_text?: string };
      break;
    } catch {
      continue;
    }
  }

  const text = typeof response?.output_text === "string" ? response.output_text.trim() : "";
  return text.length > 0 ? text : "";
}

async function renderPdfPagesToPngBuffers(
  buffer: Buffer,
  filename: string,
  renderScale = PDF_RENDER_SCALE,
): Promise<Buffer[]> {
  const [{ createCanvas }, { pdfjs }] = await Promise.all([
    import("@napi-rs/canvas"),
    loadPdfJsForNode("vehicle-finance.training.ocr"),
  ]);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(Number(pdf.numPages) || 0, MAX_LOCAL_OCR_PDF_PAGES);
  const renderedPages: Buffer[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const canvasContext = canvas.getContext("2d");

      await page.render({
        canvasContext,
        viewport,
        canvas,
      }).promise;

      renderedPages.push(canvas.toBuffer("image/png"));
      page.cleanup?.();
    }

    return renderedPages;
  } finally {
    await pdf.destroy?.();
  }
}

async function runTesseractOcr(buffer: Buffer, filename: string): Promise<string> {
  const images = await renderPdfPagesToPngBuffers(buffer, filename);
  if (!images.length) {
    return "";
  }

  const { createWorker } = await import("tesseract.js");
  await mkdir(TESSERACT_CACHE_PATH, { recursive: true });
  const worker = await createWorker("eng", 1, {
    cachePath: TESSERACT_CACHE_PATH,
  });

  try {
    if (typeof worker.setParameters === "function") {
      await worker.setParameters({
        tessedit_pageseg_mode: SPARSE_TEXT_PSM,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
    }

    const pageTexts: string[] = [];
    for (const image of images) {
      const result = await worker.recognize(image);
      const text = typeof result.data?.text === "string" ? result.data.text.trim() : "";
      pageTexts.push(text);
    }

    return pageTexts.filter(Boolean).join("\n\n").trim();
  } catch {
    return "";
  } finally {
    await worker.terminate();
  }
}

function chooseBestCandidate<T extends { text: string; method: VehicleFinanceTrainingExtractionMethod }>(
  candidates: Array<T & { fieldCoverage: number }>,
): T & { fieldCoverage: number } {
  return candidates.reduce((best, candidate) => {
    const candidateScore = candidate.fieldCoverage * 100 + Math.min(30, Math.round(candidate.text.length / 60));
    const bestScore = best.fieldCoverage * 100 + Math.min(30, Math.round(best.text.length / 60));
    return candidateScore > bestScore ? candidate : best;
  });
}

async function saveTrainingResult(args: VehicleFinanceTrainingResult) {
  await getFirebaseAdmin()
    .collection(VEHICLE_FINANCE_TRAINING_RESULT_COLLECTION)
    .doc(args.documentId)
    .set(args);
}

async function updateTrainingDocumentStatus(documentId: string, status: VehicleFinanceTrainingDocument["status"]) {
  await getFirebaseAdmin()
    .collection(VEHICLE_FINANCE_TRAINING_DOCUMENT_COLLECTION)
    .doc(documentId)
    .set({ status }, { merge: true });
}

export async function runVehicleFinanceTrainingValidationForDocument(
  document: VehicleFinanceTrainingDocument,
): Promise<VehicleFinanceTrainingResult> {
  const template = getVehicleFinanceTrainingTemplate(document.category);
  const bucket = getFirebaseStorageBucket();
  const file = bucket.file(document.storagePath);
  const [, fileResult] = await Promise.allSettled([file.getMetadata(), file.download()]);

  if (fileResult.status !== "fulfilled") {
    const failure: VehicleFinanceTrainingResult = {
      documentId: document.documentId,
      category: document.category,
      extractionMethod: "PDF_TEXT",
      extractedTextLength: 0,
      extractedFields: {},
      confidenceScore: 0,
      passedValidation: false,
      validationErrors: ["Training file download failed"],
      createdAt: new Date().toISOString(),
      pdfTextLength: 0,
      openAiOcrTextLength: 0,
      tesseractOcrTextLength: 0,
      selectedTextPreview: "",
      missingFields: [...template.requiredFields],
      expectedFields: [...template.requiredFields],
    };

    await saveTrainingResult(failure);
    await updateTrainingDocumentStatus(document.documentId, "FAILED");
    return failure;
  }

  const buffer = Buffer.from(fileResult.value[0] as Uint8Array);
  const filename = document.filename || "document.pdf";
  const pdfExtraction = await extractTextFromPdfDetailed(buffer, {
    filename,
    documentType: document.category,
    storagePath: document.storagePath,
  });
  const openAiText = await runOpenAiOcr(buffer, filename);
  const tesseractText = await runTesseractOcr(buffer, filename);

  const candidateTexts = [
    { method: "PDF_TEXT" as const, text: pdfExtraction.text ?? "" },
    { method: "OPENAI_OCR" as const, text: openAiText },
    { method: "TESSERACT_OCR" as const, text: tesseractText },
  ];

  const candidates = candidateTexts.map((candidate) => {
    const extractedFields = extractVehicleFinanceTrainingFields(document.category, candidate.text);
    const fieldCoverage = template.requiredFields.filter((field) => (extractedFields[field] ?? "").trim()).length /
      template.requiredFields.length;
    return {
      ...candidate,
      extractedFields,
      fieldCoverage,
      similarity:
        candidate.method === "PDF_TEXT"
          ? compareTextSimilarity(candidate.text, openAiText || tesseractText)
          : compareTextSimilarity(candidate.text, pdfExtraction.text || ""),
    };
  });

  const bestCandidate = chooseBestCandidate(candidates);
  const missingFields = getVehicleFinanceTrainingMissingFields(template, bestCandidate.extractedFields);
  const validationErrors = missingFields.map((field) => `${field} missing`);
  if (!bestCandidate.text.trim()) {
    validationErrors.unshift("No readable text extracted");
  }

  const confidenceScore = calculateVehicleFinanceTrainingConfidence({
    template,
    extractedFields: bestCandidate.extractedFields,
    extractedText: bestCandidate.text,
  });
  const passedValidation = bestCandidate.text.trim().length > 0 && missingFields.length === 0;

  const result: VehicleFinanceTrainingResult = {
    documentId: document.documentId,
    category: document.category,
    extractionMethod: bestCandidate.method,
    extractedTextLength: bestCandidate.text.length,
    extractedFields: bestCandidate.extractedFields,
    confidenceScore,
    passedValidation,
    validationErrors,
    createdAt: new Date().toISOString(),
    pdfTextLength: pdfExtraction.text.length,
    openAiOcrTextLength: openAiText.length,
    tesseractOcrTextLength: tesseractText.length,
    selectedTextPreview: textPreview(bestCandidate.text),
    missingFields,
    expectedFields: [...template.requiredFields],
  };

  await saveTrainingResult(result);
  await updateTrainingDocumentStatus(document.documentId, passedValidation ? "VALIDATED" : "NEEDS_REVIEW");

  console.log("[VEHICLE_FINANCE_TRAINING_VALIDATION]", {
    documentId: document.documentId,
    category: document.category,
    pdfTextLength: pdfExtraction.text.length,
    openAiOcrTextLength: openAiText.length,
    tesseractOcrTextLength: tesseractText.length,
    extractionMethod: result.extractionMethod,
    passedValidation: result.passedValidation,
    confidenceScore: result.confidenceScore,
  });

  return result;
}

export async function runVehicleFinanceTrainingValidation(documentId?: string) {
  const documents = await listVehicleFinanceTrainingDocuments();
  const targets = documentId ? documents.filter((document) => document.documentId === documentId) : documents;
  const results: VehicleFinanceTrainingResult[] = [];

  for (const document of targets) {
    results.push(await runVehicleFinanceTrainingValidationForDocument(document));
  }

  return {
    processed: results.length,
    results,
  };
}

export async function listVehicleFinanceTrainingDocuments(): Promise<VehicleFinanceTrainingDocument[]> {
  const snapshot = await getFirebaseAdmin()
    .collection(VEHICLE_FINANCE_TRAINING_DOCUMENT_COLLECTION)
    .limit(500)
    .get();

  return snapshot.docs
    .map((doc) => ({
      documentId: doc.id,
      ...(doc.data() ?? {}),
    }) as VehicleFinanceTrainingDocument)
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

export async function listVehicleFinanceTrainingResults(): Promise<VehicleFinanceTrainingResult[]> {
  const snapshot = await getFirebaseAdmin()
    .collection(VEHICLE_FINANCE_TRAINING_RESULT_COLLECTION)
    .limit(500)
    .get();

  return snapshot.docs
    .map((doc) => ({
      documentId: doc.id,
      ...(doc.data() ?? {}),
    }) as VehicleFinanceTrainingResult)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getVehicleFinanceTrainingOverview() {
  const [documents, results] = await Promise.all([
    listVehicleFinanceTrainingDocuments(),
    listVehicleFinanceTrainingResults(),
  ]);

  const resultByDocumentId = new Map(results.map((result) => [result.documentId, result]));
  const validatedDocuments = results.filter((result) => result.passedValidation).length;
  const failedDocuments = results.filter((result) => !result.passedValidation).length;
  const ocrSuccessRate = results.length > 0 ? Math.round((results.filter((result) => result.extractedTextLength > 0).length / results.length) * 100) : 0;
  const averageConfidence = results.length > 0 ? Math.round(results.reduce((sum, result) => sum + result.confidenceScore, 0) / results.length) : 0;
  const extractionAccuracy = results.length > 0
    ? Math.round(
        results.reduce((sum, result) => {
          const expected = result.expectedFields?.length ?? 0;
          const matched = result.expectedFields?.filter((field) => (result.extractedFields[field] ?? "").trim()).length ?? 0;
          return sum + (expected > 0 ? (matched / expected) * 100 : 0);
        }, 0) / results.length
      )
    : 0;
  const missingFields = results.reduce((sum, result) => sum + (result.missingFields?.length ?? 0), 0);

  return {
    metrics: {
      ocrSuccessRate,
      averageConfidence,
      extractionAccuracy,
      failedDocuments,
      missingFields,
      totalDocuments: documents.length,
      validatedDocuments,
    },
    documents,
    results,
    categories: getVehicleFinanceTrainingCategories(),
    templates: getVehicleFinanceTrainingCategories().map((category) => getVehicleFinanceTrainingTemplate(category)),
    resultByDocumentId: Object.fromEntries(resultByDocumentId.entries()),
  };
}
