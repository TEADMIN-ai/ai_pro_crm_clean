import path from "path";

import type { PdfReferenceFolder, PdfReferenceLibrarySpec } from "./types";

export const DEFAULT_PDF_REFERENCE_LIBRARY: PdfReferenceLibrarySpec = {
  rootRelativePath: path.join("documents", "PDF Reference Standards"),
  folders: [
    { role: "blank_forms", label: "Blank Forms", relativePath: "Blank Forms", required: true },
    { role: "approved_completed", label: "Approved Completed", relativePath: "Approved Completed", required: true },
    { role: "notes", label: "Notes", relativePath: "Notes", required: true },
    { role: "teos_generated", label: "TEOS Generated", relativePath: "TEOS Generated", required: false },
    { role: "difference_reports", label: "Difference Reports", relativePath: "Difference Reports", required: false },
    { role: "field_maps", label: "Field Maps", relativePath: "Field Maps", required: false },
    { role: "json", label: "JSON", relativePath: "JSON", required: false },
    { role: "fonts", label: "Fonts", relativePath: "Fonts", required: false },
    { role: "screenshots", label: "Screenshots", relativePath: "Screenshots", required: false },
    { role: "signatures", label: "Signatures", relativePath: "Signatures", required: false },
    { role: "version_history", label: "Version History", relativePath: "Version History", required: false },
  ],
};

export function resolveReferenceFolder(
  spec: PdfReferenceLibrarySpec,
  role: PdfReferenceFolder["role"],
  cwd = process.cwd()
): string | null {
  const folder = spec.folders.find((item) => item.role === role);
  return folder ? path.join(cwd, spec.rootRelativePath, folder.relativePath) : null;
}

export function extendReferenceLibrarySpec(
  spec: PdfReferenceLibrarySpec,
  folders: PdfReferenceFolder[]
): PdfReferenceLibrarySpec {
  const existingRoles = new Set(spec.folders.map((folder) => folder.role));
  const merged = [...spec.folders];

  for (const folder of folders) {
    if (!existingRoles.has(folder.role)) {
      merged.push(folder);
    }
  }

  return {
    ...spec,
    folders: merged,
  };
}
