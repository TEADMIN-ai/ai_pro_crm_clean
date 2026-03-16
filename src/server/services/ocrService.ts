import Tesseract from "tesseract.js";

export async function extractTextOCR(buffer: Buffer): Promise<string> {
  try {
    console.log("OCR processing started");

    const result = await Tesseract.recognize(buffer, "eng", {
      logger: (m) => console.log("[OCR]", m.status),
    });

    const text = result?.data?.text ?? "";

    console.log("OCR text length:", text.length);

    return text;
  } catch (err) {
    console.warn("OCR failed:", err);

    return "";
  }
}
