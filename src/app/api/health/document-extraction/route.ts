import { NextResponse } from "next/server";

import { detectAvailableOcrModel } from "@/server/services/ocrService";
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
  const [canvasLoaded, pdfjsLoaded, availableModel] = await Promise.all([
    canLoadCanvas(),
    canLoadPdfJs(),
    detectAvailableOcrModel(),
  ]);

  return NextResponse.json(
    {
      pdfExtractionAvailable: pdfjsLoaded,
      ocrAvailable: Boolean(availableModel),
      availableModel,
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
