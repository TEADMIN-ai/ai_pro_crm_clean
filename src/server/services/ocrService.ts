import OpenAI from "openai";

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";

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
    model: DEFAULT_OPENAI_MODEL,
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

  const client = getOpenAIClient();
  if (!client) {
    console.warn("[OCR_SKIPPED]", {
      filename: options?.filename ?? "document",
      reason: "missing_api_key",
      ...runtimeDiagnostics,
    });
    console.log("[OCR_TEXT_LENGTH]", {
      filename: options?.filename ?? "document",
      textLength: 0,
      bytes: buffer.length,
      pageCount: options?.pageCount ?? null,
      skipped: "missing_api_key",
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
    model: DEFAULT_OPENAI_MODEL,
  });

  try {
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

    const response = await client.responses.create({
      model: DEFAULT_OPENAI_MODEL,
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
    const text = typeof response.output_text === "string" ? response.output_text.trim() : "";

    console.log("[OCR_REQUEST_SUCCESS]", {
      filename: input.filename,
      textLength: text.length,
      bytes: buffer.length,
      pageCount: options?.pageCount ?? null,
      openAIReached: true,
      ...runtimeDiagnostics,
    });

    console.log("[OCR_TEXT_LENGTH]", {
      filename: input.filename,
      textLength: text.length,
      bytes: buffer.length,
      pageCount: options?.pageCount ?? null,
    });

    return text;
  } catch (error) {
    console.error("OCR service failed:", {
      requestPath: input.requestPath,
      inputType: input.inputType,
      filename: input.filename,
      mimeType: input.mimeType,
      openAIReached: true,
      ...runtimeDiagnostics,
      error: toLoggableError(error),
    });
    console.log("[OCR_TEXT_LENGTH]", {
      filename: input.filename,
      textLength: 0,
      bytes: buffer.length,
      pageCount: options?.pageCount ?? null,
      failed: true,
    });
    return "";
  }
}
