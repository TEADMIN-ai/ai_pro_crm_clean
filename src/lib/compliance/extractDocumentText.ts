import { extractTextFromPdf } from "@/lib/pdf/extractTextFromPdf";

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
  return extractTextFromPdf(Buffer.from(arrayBuffer));
}
