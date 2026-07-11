import type { PdfStaticLayoutRegion } from "./types";

export function filterCheckboxLocations(regions: PdfStaticLayoutRegion[]): PdfStaticLayoutRegion[] {
  return regions.filter((region) => region.kind === "checkbox_location");
}
