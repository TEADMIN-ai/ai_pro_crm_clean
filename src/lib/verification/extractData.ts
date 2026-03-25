import { extractTextFromPdf } from "@/lib/pdf/extractTextFromPdf";

type PdfSource = string | Buffer | Uint8Array;

async function resolvePdfBinary(source: PdfSource): Promise<Buffer | Uint8Array> {
  if (typeof source !== "string") {
    return source;
  }

  const response = await fetch(source);

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF for extraction (${response.status})`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function extractDocumentData(source: PdfSource) {
  const binary = await resolvePdfBinary(source);
  const text = await extractTextFromPdf(binary);

  return {
    rawText: text,
    hasCIPC: /cipc|registration/i.test(text),
    hasTax: /tax|clearance/i.test(text),
    hasBBEEE: /bbbee|b-bbee/i.test(text),
    hasCOIDA: /coida|compensation fund/i.test(text),
  };
}
