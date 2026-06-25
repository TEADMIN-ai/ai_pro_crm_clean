import type { QsImportFileType, QsParsedImportRow } from "@/types/qs";

export type QsParseResult = {
  fileType: QsImportFileType;
  columns: string[];
  rows: QsParsedImportRow[];
};

export type QsImportParser = {
  parse(buffer: Buffer): Promise<QsParseResult>;
};
