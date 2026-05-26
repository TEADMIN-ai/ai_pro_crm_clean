const PDFJS_NODE_SPECIFIERS = [
  "pdfjs-dist/legacy/build/pdf.mjs",
  "pdfjs-dist/legacy/build/pdf.js",
  "pdfjs-dist/legacy/build/pdf",
] as const;

const importPdfJsModule = new Function("specifier", "return import(specifier);") as (
  specifier: string
) => Promise<any>;

type PdfJsRuntimeModule = {
  pdfjs: any;
  specifier: (typeof PDFJS_NODE_SPECIFIERS)[number];
  compatibilityMode: "node-legacy";
};

const isNodeRuntime =
  typeof process === "object" &&
  process !== null &&
  process + "" === "[object process]";

let cachedPdfJsRuntimePromise: Promise<PdfJsRuntimeModule> | null = null;

async function loadPdfJsForNodeUncached(diagnosticLabel: string): Promise<PdfJsRuntimeModule> {
  let lastError: unknown;

  for (const specifier of PDFJS_NODE_SPECIFIERS) {
    try {
      const pdfjs = await importPdfJsModule(specifier);

      console.info("[PDFJS_RUNTIME]", {
        diagnosticLabel,
        stage: "load_success",
        specifier,
        compatibilityMode: "node-legacy",
        isNodeRuntime,
        hasDOMMatrix: typeof globalThis.DOMMatrix !== "undefined",
        hasWindow: typeof globalThis.window !== "undefined",
        hasDocument: typeof globalThis.document !== "undefined",
      });

      return {
        pdfjs,
        specifier,
        compatibilityMode: "node-legacy",
      };
    } catch (error) {
      lastError = error;
      console.warn("[PDFJS_RUNTIME]", {
        diagnosticLabel,
        stage: "load_attempt_failed",
        specifier,
        compatibilityMode: "node-legacy",
        isNodeRuntime,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error
    ? new Error(`PDF.js Node legacy initialization failed: ${lastError.message}`)
    : new Error("PDF.js Node legacy initialization failed");
}

export async function loadPdfJsForNode(diagnosticLabel: string): Promise<PdfJsRuntimeModule> {
  if (!cachedPdfJsRuntimePromise) {
    cachedPdfJsRuntimePromise = loadPdfJsForNodeUncached(diagnosticLabel).catch((error) => {
      cachedPdfJsRuntimePromise = null;
      throw error;
    });
  }

  return cachedPdfJsRuntimePromise;
}

export function getPdfJsNodeSpecifiers(): readonly string[] {
  return PDFJS_NODE_SPECIFIERS;
}
