import type { QsBoqFileType } from "@/types/qs";

export function detectBoqFileType(fileName: string, mimeType?: string | null): QsBoqFileType {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType?.toLowerCase() ?? "";

  if (lowerName.endsWith(".pdf") || lowerMime.includes("pdf")) return "pdf";
  if (lowerName.endsWith(".docx") || lowerMime.includes("wordprocessingml")) return "docx";
  if (lowerName.endsWith(".xlsx") || lowerMime.includes("spreadsheetml")) return "xlsx";
  if (lowerName.endsWith(".csv") || lowerMime.includes("csv")) return "csv";
  if (lowerName.endsWith(".txt") || lowerMime.includes("text/plain")) return "txt";

  throw new Error(`Unsupported BOQ file type: ${fileName}`);
}
