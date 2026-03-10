import { PDFParse } from "pdf-parse";

export async function extractDocumentText(fileUrl: string): Promise<string> {
  const normalizedUrl = fileUrl.trim();

  if (!normalizedUrl) {
    throw new Error("Missing fileUrl");
  }

  const response = await fetch(normalizedUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const parser = new PDFParse({
    data: new Uint8Array(arrayBuffer),
  });

  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}
