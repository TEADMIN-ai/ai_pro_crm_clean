import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { configurePdfJsWorker } from "@/lib/pdf/pdfWorker";

type TextItem = {
  str?: string;
};

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  configurePdfJsWorker();

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  try {
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item) => ("str" in item ? (item as TextItem).str ?? "" : ""))
        .filter(Boolean);

      pages.push(strings.join(" ").trim());
    }

    return pages.filter(Boolean).join("\n").trim();
  } finally {
    await loadingTask.destroy();
  }
}
