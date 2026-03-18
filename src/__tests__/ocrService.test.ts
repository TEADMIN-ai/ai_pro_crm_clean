const responsesCreate = jest.fn();

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

describe("ocrService", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    responsesCreate.mockReset();
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
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
});
