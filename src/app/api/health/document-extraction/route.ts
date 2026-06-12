import { NextResponse } from "next/server";

import { detectAvailableOcrProvider } from "@/server/services/ocrService";
import { loadPdfJsForNode } from "@/lib/pdf/loadPdfJsForNode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function canLoadCanvas(): Promise<boolean> {
  try {
    await import("@napi-rs/canvas");
    return true;
  } catch {
    return false;
  }
}

async function canLoadPdfJs(): Promise<boolean> {
  try {
    await loadPdfJsForNode("health.document-extraction");
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [canvasLoaded, pdfjsLoaded, ocrProviderStatus] = await Promise.all([
    canLoadCanvas(),
    canLoadPdfJs(),
    detectAvailableOcrProvider(),
  ]);
  const localOcrAvailable = ocrProviderStatus.provider === "tesseract";

  return NextResponse.json(
    {
      pdfExtractionAvailable: pdfjsLoaded,
      ocrAvailable: Boolean(ocrProviderStatus.availableModel) || localOcrAvailable,
      availableModel: ocrProviderStatus.availableModel,
      ocrProvider: ocrProviderStatus.provider,
      canvasLoaded,
      pdfjsLoaded,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
