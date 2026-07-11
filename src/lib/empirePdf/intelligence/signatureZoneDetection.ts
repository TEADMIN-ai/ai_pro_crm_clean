import type { PdfStaticLayoutRegion } from "./types";

export function filterSignatureZones(regions: PdfStaticLayoutRegion[]): PdfStaticLayoutRegion[] {
  return regions.filter((region) => region.kind === "signature_block");
}
