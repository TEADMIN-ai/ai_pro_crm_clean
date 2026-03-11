import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfjsWorkerModule from "pdfjs-dist/legacy/build/pdf.worker.mjs";

declare global {
  // PDF.js checks this global before trying to import the worker source.
  var pdfjsWorker: typeof pdfjsWorkerModule | undefined;
}

let isConfigured = false;

export function configurePdfJsWorker(): void {
  if (isConfigured) {
    return;
  }

  if (typeof window === "undefined") {
    globalThis.pdfjsWorker = pdfjsWorkerModule;
  } else {
    const workerSrc = (pdfjsWorkerModule as { default?: string }).default;

    if (typeof workerSrc === "string" && workerSrc.length > 0) {
      GlobalWorkerOptions.workerSrc = workerSrc;
    } else {
      GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/pdf.worker.min.mjs";
    }
  }

  isConfigured = true;
}
