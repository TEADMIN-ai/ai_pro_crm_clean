import { detectBoqFileType } from "./detectFileType";
import { parseDocxBoq } from "./docxParser";
import { parsePdfBoq } from "./pdfParser";
import { parseTextBoq } from "./textParser";
import type { QsBoqParsedDocument, QsBoqParserInput } from "./types";
import { parseXlsxBoq } from "./xlsxParser";

export async function parseBoqDocument(input: QsBoqParserInput): Promise<QsBoqParsedDocument> {
  const fileType = detectBoqFileType(input.fileName, input.mimeType);

  switch (fileType) {
    case "pdf":
      return parsePdfBoq(input);
    case "docx":
      return parseDocxBoq(input);
    case "xlsx":
      return parseXlsxBoq(input);
    case "csv":
    case "txt":
      return parseTextBoq(input, fileType);
    default:
      throw new Error(`Unsupported BOQ file type: ${fileType}`);
  }
}
