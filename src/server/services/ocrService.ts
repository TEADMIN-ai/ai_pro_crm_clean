import OpenAI from "openai";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadPdfJsForNode } from "@/lib/pdf/loadPdfJsForNode";

export const OCR_MODEL_CANDIDATES = ["gpt-4.1", "gpt-4o", "gpt-4-turbo"] as const;
const LOCAL_OCR_PROVIDER = "tesseract" as const;
const OPENAI_OCR_PROVIDER = "openai" as const;
const MAX_LOCAL_OCR_PDF_PAGES = 3;
const PDF_RENDER_SCALE = 2;
const TESSERACT_CACHE_PATH = path.join(os.tmpdir(), "tesseract-cache");

export type OcrProvider = typeof OPENAI_OCR_PROVIDER | typeof LOCAL_OCR_PROVIDER;

type OcrOptions = {
  filename?: string;
  mimeType?: string;
  pageCount?: number;
};

type SupportedOcrInput =
  | {
      inputType: "pdf";
      mimeType: "application/pdf";
      filename: string;
      requestPath: "responses.input_file.file_data";
      payload: {
        type: "input_file";
        filename: string;
        file_data: string;
      };
    }
  | {
      inputType: "image";
      mimeType: string;
      filename: string;
      requestPath: "responses.input_image.image_url";
      payload: {
        type: "input_image";
        detail: "high";
        image_url: string;
      };
    };

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function getRuntimeDiagnostics() {
  return {
    nodeVersion: process.version,
    openAiApiKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    modelCandidates: [...OCR_MODEL_CANDIDATES],
  };
}

function hasExtension(filename: string): boolean {
  return /\.[a-z0-9]+$/i.test(filename);
}

function detectMimeType(buffer: Buffer, mimeType?: string): string | null {
  const explicitMimeType = mimeType?.trim().toLowerCase();
  if (explicitMimeType) {
    return explicitMimeType;
  }

  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") {
      return "image/gif";
    }
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function normalizeFilename(filename: string | undefined, mimeType: string): string {
  const trimmed = filename?.trim() || "document";
  if (hasExtension(trimmed)) {
    return trimmed;
  }

  switch (mimeType) {
    case "application/pdf":
      return `${trimmed}.pdf`;
    case "image/png":
      return `${trimmed}.png`;
    case "image/jpeg":
      return `${trimmed}.jpg`;
    case "image/gif":
      return `${trimmed}.gif`;
    case "image/webp":
      return `${trimmed}.webp`;
    default:
      return trimmed;
  }
}

function buildSupportedInput(buffer: Buffer, options?: OcrOptions): SupportedOcrInput | null {
  const mimeType = detectMimeType(buffer, options?.mimeType);
  if (!mimeType) {
    return null;
  }

  const filename = normalizeFilename(options?.filename, mimeType);
  const base64 = buffer.toString("base64");

  if (mimeType === "application/pdf") {
    return {
      inputType: "pdf",
      mimeType,
      filename,
      requestPath: "responses.input_file.file_data",
      payload: {
        type: "input_file",
        filename,
        file_data: `data:${mimeType};base64,${base64}`,
      },
    };
  }

  if (mimeType.startsWith("image/")) {
    return {
      inputType: "image",
      mimeType,
      filename,
      requestPath: "responses.input_image.image_url",
      payload: {
        type: "input_image",
        detail: "high",
        image_url: `data:${mimeType};base64,${base64}`,
      },
    };
  }

  return null;
}

function toLoggableError(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    return {
      name: error.name,
      status: error.status,
      code: error.code,
      type: error.type,
      message: error.message,
      param: error.param,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return { error };
}

function isModelAccessError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 403 && error.code === "model_not_found";
  }

  return false;
}

function isSupportedOcrModel(modelId: string): modelId is (typeof OCR_MODEL_CANDIDATES)[number] {
  return OCR_MODEL_CANDIDATES.includes(modelId as (typeof OCR_MODEL_CANDIDATES)[number]);
}

async function createOcrResponse(
  client: OpenAI,
  model: string,
  input: SupportedOcrInput,
) {
  return client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          input.payload,
          {
            type: "input_text",
            text: "Extract all readable text from this document. Return only extracted text.",
          },
        ],
      },
    ],
  });
}

export async function discoverAvailableOcrModels(): Promise<string[]> {
  const client = getOpenAIClient();
  if (!client) {
    console.log("[AVAILABLE_OCR_MODELS]", {
      provider: OPENAI_OCR_PROVIDER,
      models: [],
      reason: "missing_api_key",
    });
    return [];
  }

  try {
    const models = await client.models.list();
    const availableModels = models.data
      .map((model) => model.id)
      .filter(isSupportedOcrModel);

    console.log("[AVAILABLE_OCR_MODELS]", {
      provider: OPENAI_OCR_PROVIDER,
      models: availableModels,
      source: "models.list",
    });

    if (availableModels.length > 0) {
      return availableModels;
    }
  } catch (error) {
    console.warn("[AVAILABLE_OCR_MODELS]", {
      provider: OPENAI_OCR_PROVIDER,
      models: [],
      source: "models.list",
      error: toLoggableError(error),
    });
  }

  const probedModels: string[] = [];
  for (const model of OCR_MODEL_CANDIDATES) {
    try {
      console.log("[OCR_MODEL_SELECTED]", {
        model,
        purpose: "model_discovery",
      });

      await client.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Return OK.",
              },
            ],
          },
        ],
        max_output_tokens: 8,
      });

      console.log("[OCR_MODEL_SUCCESS]", {
        model,
        purpose: "model_discovery",
      });
      probedModels.push(model);
    } catch (error) {
      console.warn("[OCR_MODEL_FAILED]", {
        model,
        purpose: "model_discovery",
        error: toLoggableError(error),
      });
    }
  }

  console.log("[AVAILABLE_OCR_MODELS]", {
    provider: OPENAI_OCR_PROVIDER,
    models: probedModels,
    source: "responses.probe",
  });

  return probedModels;
}

export async function detectAvailableOcrModel(): Promise<string | null> {
  const availableModels = await discoverAvailableOcrModels();
  return availableModels[0] ?? null;
}

async function localOcrAvailable(): Promise<boolean> {
  try {
    await import("tesseract.js");
    return true;
  } catch {
    return false;
  }
}

export async function detectAvailableOcrProvider(): Promise<{
  provider: OcrProvider | null;
  availableModel: string | null;
  availableModels: string[];
}> {
  const availableModels = await discoverAvailableOcrModels();
  if (availableModels.length > 0) {
    return {
      provider: OPENAI_OCR_PROVIDER,
      availableModel: availableModels[0] ?? null,
      availableModels,
    };
  }

  return {
    provider: (await localOcrAvailable()) ? LOCAL_OCR_PROVIDER : null,
    availableModel: null,
    availableModels,
  };
}

async function renderPdfPagesToPngBuffers(buffer: Buffer, filename: string): Promise<Buffer[]> {
  const [{ createCanvas }, { pdfjs }] = await Promise.all([
    import("@napi-rs/canvas"),
    loadPdfJsForNode("ocr.local.pdf-render"),
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

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const canvasContext = canvas.getContext("2d");

    await page.render({
      canvasContext,
      viewport,
      canvas,
    }).promise;

    renderedPages.push(canvas.toBuffer("image/png"));
  }

  await pdf.destroy?.();

  console.log("[LOCAL_OCR_PDF_RENDERED]", {
    filename,
    renderedPages: renderedPages.length,
    maxPages: MAX_LOCAL_OCR_PDF_PAGES,
  });

  return renderedPages;
}

async function buildLocalOcrImages(buffer: Buffer, input: SupportedOcrInput): Promise<Buffer[]> {
  if (input.inputType === "image") {
    return [buffer];
  }

  return renderPdfPagesToPngBuffers(buffer, input.filename);
}

async function runLocalOCR(buffer: Buffer, input: SupportedOcrInput, options?: OcrOptions): Promise<string> {
  console.log("[OCR_PROVIDER_SELECTED]", {
    provider: LOCAL_OCR_PROVIDER,
    filename: input.filename,
    inputType: input.inputType,
  });

  try {
    const { createWorker } = await import("tesseract.js");
    const images = await buildLocalOcrImages(buffer, input);
    await mkdir(TESSERACT_CACHE_PATH, { recursive: true });
    const worker = await createWorker("eng", 1, {
      cachePath: TESSERACT_CACHE_PATH,
    });
    const texts: string[] = [];

    try {
      for (const [index, image] of images.entries()) {
        const result = await worker.recognize(image);
        const text = typeof result.data?.text === "string" ? result.data.text.trim() : "";
        texts.push(text);

        console.log("[LOCAL_OCR_PAGE_RESULT]", {
          filename: input.filename,
          pageIndex: index,
          textLength: text.length,
        });
      }
    } finally {
      await worker.terminate();
    }

    const text = texts.filter(Boolean).join("\n\n").trim();

    console.log("[OCR_PROVIDER_SUCCESS]", {
      provider: LOCAL_OCR_PROVIDER,
      filename: input.filename,
      textLength: text.length,
      bytes: buffer.length,
      pageCount: options?.pageCount ?? null,
    });
    console.log("[OCR_TEXT_LENGTH]", {
      filename: input.filename,
      textLength: text.length,
      bytes: buffer.length,
      pageCount: options?.pageCount ?? null,
      provider: LOCAL_OCR_PROVIDER,
    });

    return text;
  } catch (error) {
    console.error("[OCR_PROVIDER_FAILED]", {
      provider: LOCAL_OCR_PROVIDER,
      filename: input.filename,
      inputType: input.inputType,
      error: toLoggableError(error),
    });
    return "";
  }
}

async function runOpenAIOCR(
  client: OpenAI,
  buffer: Buffer,
  input: SupportedOcrInput,
  runtimeDiagnostics: ReturnType<typeof getRuntimeDiagnostics>,
  options?: OcrOptions,
): Promise<string | null> {
  console.log("[OCR_PROVIDER_SELECTED]", {
    provider: OPENAI_OCR_PROVIDER,
    filename: input.filename,
    modelCandidates: [...OCR_MODEL_CANDIDATES],
  });

  console.log("[OCR_REQUEST_START]", {
    filename: input.filename,
    mimeType: input.mimeType,
    inputType: input.inputType,
    requestPath: input.requestPath,
    bytes: buffer.length,
    pageCount: options?.pageCount ?? null,
    openAIReached: true,
    ...runtimeDiagnostics,
  });

  let response: Awaited<ReturnType<typeof createOcrResponse>> | null = null;
  let resolvedModel: string | null = null;
  let lastError: unknown = null;

  for (const model of OCR_MODEL_CANDIDATES) {
    try {
      console.log("[OCR_MODEL_SELECTED]", {
        filename: input.filename,
        model,
      });
      response = await createOcrResponse(client, model, input);
      resolvedModel = model;
      console.log("[OCR_MODEL_SUCCESS]", {
        filename: input.filename,
        model,
      });
      break;
    } catch (error) {
      lastError = error;
      console.warn("[OCR_MODEL_FAILED]", {
        filename: input.filename,
        model,
        error: toLoggableError(error),
      });

      if (!isModelAccessError(error)) {
        break;
      }
    }
  }

  if (!response || !resolvedModel) {
    console.warn("[OCR_PROVIDER_FAILED]", {
      provider: OPENAI_OCR_PROVIDER,
      filename: input.filename,
      error: toLoggableError(lastError ?? new Error("No OCR model succeeded")),
    });
    return null;
  }

  const text = typeof response.output_text === "string" ? response.output_text.trim() : "";

  console.log("[OCR_MODEL_SUCCESS]", {
    filename: input.filename,
    model: resolvedModel,
  });
  console.log("[OCR_PROVIDER_SUCCESS]", {
    provider: OPENAI_OCR_PROVIDER,
    filename: input.filename,
    model: resolvedModel,
    textLength: text.length,
  });
  console.log("[OCR_REQUEST_SUCCESS]", {
    filename: input.filename,
    textLength: text.length,
    bytes: buffer.length,
    pageCount: options?.pageCount ?? null,
    openAIReached: true,
    resolvedModel,
    ...runtimeDiagnostics,
  });

  return text;
}

export async function runOCR(buffer: Buffer, options?: OcrOptions): Promise<string> {
  const runtimeDiagnostics = getRuntimeDiagnostics();

  console.log("[OCR_ENV_CHECK]", {
    filename: options?.filename ?? "document",
    bytes: buffer.length,
    pageCount: options?.pageCount ?? null,
    ...runtimeDiagnostics,
  });

  if (!buffer.length) {
    console.log("[OCR_TEXT_LENGTH]", {
      filename: options?.filename ?? "document",
      textLength: 0,
      bytes: 0,
      pageCount: options?.pageCount ?? null,
    });
    return "";
  }

  const input = buildSupportedInput(buffer, options);
  if (!input) {
    console.warn("[OCR_SKIPPED]", {
      filename: options?.filename ?? "document",
      reason: "unsupported_input",
      mimeType: options?.mimeType ?? null,
      bytes: buffer.length,
      ...runtimeDiagnostics,
    });
    console.log("[OCR_TEXT_LENGTH]", {
      filename: options?.filename ?? "document",
      textLength: 0,
      bytes: buffer.length,
      pageCount: options?.pageCount ?? null,
      skipped: "unsupported_input",
    });
    return "";
  }

  console.log("[OCR_FALLBACK]", {
    activated: true,
    filename: input.filename,
    mimeType: input.mimeType,
    bytes: buffer.length,
    pageCount: options?.pageCount ?? null,
    inputType: input.inputType,
    requestPath: input.requestPath,
    modelCandidates: [...OCR_MODEL_CANDIDATES],
  });

  const client = getOpenAIClient();
  if (client) {
    const openAiText = await runOpenAIOCR(client, buffer, input, runtimeDiagnostics, options);
    if (openAiText !== null) {
      console.log("[OCR_TEXT_LENGTH]", {
        filename: input.filename,
        textLength: openAiText.length,
        bytes: buffer.length,
        pageCount: options?.pageCount ?? null,
        provider: OPENAI_OCR_PROVIDER,
      });
      return openAiText;
    }

    console.warn("[OCR_PROVIDER_FALLBACK]", {
      from: OPENAI_OCR_PROVIDER,
      to: LOCAL_OCR_PROVIDER,
      filename: input.filename,
      reason: "openai_unavailable",
    });
  } else {
    console.warn("[OCR_PROVIDER_FALLBACK]", {
      from: OPENAI_OCR_PROVIDER,
      to: LOCAL_OCR_PROVIDER,
      filename: input.filename,
      reason: "missing_api_key",
    });
  }

  return runLocalOCR(buffer, input, options);
}
