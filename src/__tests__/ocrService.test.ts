const responsesCreate = jest.fn();
const tesseractRecognize = jest.fn();
const tesseractTerminate = jest.fn();
const tesseractCreateWorker = jest.fn();

jest.mock("openai", () => {
  class APIError extends Error {
    status?: number;
    code?: string;
    type?: string;
    param?: string;
  }

  return {
    __esModule: true,
    default: class OpenAI {
      static APIError = APIError;
      responses = {
        create: responsesCreate,
      };

      constructor(_: { apiKey: string }) {}
    },
  };
});

jest.mock("tesseract.js", () => ({
  __esModule: true,
  createWorker: tesseractCreateWorker,
}));

describe("ocrService", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalDocumentModel = process.env.OPENAI_DOCUMENT_MODEL;

  beforeEach(() => {
    jest.resetModules();
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_DOCUMENT_MODEL;
    responsesCreate.mockReset();
    tesseractRecognize.mockReset();
    tesseractTerminate.mockReset();
    tesseractCreateWorker.mockReset();
    tesseractTerminate.mockResolvedValue(undefined);
    tesseractCreateWorker.mockResolvedValue({
      recognize: tesseractRecognize,
      terminate: tesseractTerminate,
    });
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_DOCUMENT_MODEL = originalDocumentModel;
  });

  test("sends PDF buffers through responses.input_file.file_data", async () => {
    responsesCreate.mockResolvedValue({ output_text: "PDF text" });
    const { runOCR } = await import("@/server/services/ocrService");

    const pdfBuffer = Buffer.from("%PDF-1.7 sample", "ascii");
    const result = await runOCR(pdfBuffer, { filename: "registration" });

    expect(result).toBe("PDF text");
    expect(responsesCreate).toHaveBeenCalledTimes(1);
    expect(responsesCreate.mock.calls[0][0].input[0].content[0]).toMatchObject({
      type: "input_file",
      filename: "registration.pdf",
    });
    expect(responsesCreate.mock.calls[0][0].input[0].content[0].file_data).toMatch(
      /^data:application\/pdf;base64,/
    );
  });

  test("sends image buffers through responses.input_image.image_url", async () => {
    responsesCreate.mockResolvedValue({ output_text: "Image text" });
    const { runOCR } = await import("@/server/services/ocrService");

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const result = await runOCR(pngBuffer, { filename: "scan" });

    expect(result).toBe("Image text");
    expect(responsesCreate).toHaveBeenCalledTimes(1);
    expect(responsesCreate.mock.calls[0][0].input[0].content[0]).toMatchObject({
      type: "input_image",
      detail: "high",
    });
    expect(responsesCreate.mock.calls[0][0].input[0].content[0].image_url).toMatch(
      /^data:image\/png;base64,/
    );
  });

  test("tries OCR models in runtime order until one succeeds", async () => {
    const OpenAI = (await import("openai")).default as unknown as {
      APIError: new (message?: string) => Error;
    };
    const modelError = Object.assign(new OpenAI.APIError("model not found"), {
      status: 403,
      code: "model_not_found",
      type: "invalid_request_error",
      param: null,
    });
    responsesCreate
      .mockRejectedValueOnce(modelError)
      .mockRejectedValueOnce(modelError)
      .mockResolvedValueOnce({ output_text: "Fallback OCR text" });

    const { runOCR } = await import("@/server/services/ocrService");

    const pdfBuffer = Buffer.from("%PDF-1.7 sample", "ascii");
    const result = await runOCR(pdfBuffer, { filename: "registration" });

    expect(result).toBe("Fallback OCR text");
    expect(responsesCreate).toHaveBeenCalledTimes(3);
    expect(responsesCreate.mock.calls[0][0].model).toBe("gpt-4.1");
    expect(responsesCreate.mock.calls[1][0].model).toBe("gpt-4o");
    expect(responsesCreate.mock.calls[2][0].model).toBe("gpt-4-turbo");
  });

  test("falls back to local Tesseract OCR when OpenAI models are unavailable", async () => {
    const OpenAI = (await import("openai")).default as unknown as {
      APIError: new (message?: string) => Error;
    };
    const modelError = Object.assign(new OpenAI.APIError("model not found"), {
      status: 403,
      code: "model_not_found",
      type: "invalid_request_error",
      param: null,
    });
    responsesCreate.mockRejectedValue(modelError);
    tesseractRecognize.mockResolvedValue({ data: { text: "Local OCR text" } });

    const { runOCR } = await import("@/server/services/ocrService");

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const result = await runOCR(pngBuffer, { filename: "scan" });

    expect(result).toBe("Local OCR text");
    expect(responsesCreate).toHaveBeenCalledTimes(3);
    expect(tesseractCreateWorker).toHaveBeenCalledWith("eng", 1, {
      cachePath: expect.stringContaining("tesseract-cache"),
    });
    expect(tesseractRecognize).toHaveBeenCalledWith(pngBuffer);
    expect(tesseractTerminate).toHaveBeenCalledTimes(1);
  });

  test("uses local Tesseract OCR when no OpenAI API key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    tesseractRecognize.mockResolvedValue({ data: { text: "Offline OCR text" } });

    const { runOCR } = await import("@/server/services/ocrService");

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const result = await runOCR(pngBuffer, { filename: "scan" });

    expect(result).toBe("Offline OCR text");
    expect(responsesCreate).not.toHaveBeenCalled();
    expect(tesseractCreateWorker).toHaveBeenCalledWith("eng", 1, {
      cachePath: expect.stringContaining("tesseract-cache"),
    });
  });
});
