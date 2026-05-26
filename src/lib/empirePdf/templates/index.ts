import type { SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";

import { SBD1_TEMPLATE } from "./sbd1";
import { SBD4_TEMPLATE } from "./sbd4";
import { SBD61_TEMPLATE } from "./sbd61";
import type { EmpirePdfTemplateDefinition } from "./types";

export const EMPIRE_PDF_TEMPLATE_REGISTRY: Partial<Record<SbdFormKey, EmpirePdfTemplateDefinition>> = {
  sbd1: SBD1_TEMPLATE,
  sbd4: SBD4_TEMPLATE,
  sbd6: SBD61_TEMPLATE,
};

export * from "./types";
