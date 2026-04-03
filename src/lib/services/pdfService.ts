import { PDFParse } from "pdf-parse";

export async function extractText(buffer: Buffer) {
  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    return data.text;
  } catch (err) {
    console.error("PDF PARSE ERROR:", err);
    return "";
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
